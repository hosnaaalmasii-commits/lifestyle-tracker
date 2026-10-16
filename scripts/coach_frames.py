# Renders mouth / blink frames for the app's coach portraits with
# LivePortrait's single-image retargeting (CPU). For each portrait:
#   base   - re-rendered face, unchanged expression (always shown under the others)
#   m0..m4 - mouth from closed to wide open
#   mo     - rounded "oo" mouth
#   e1, e2 - eyes half / fully closed (blink)
# Each frame is cropped to the area that differs from the base and saved as
# WebP, with the crop rectangles in a manifest (fractions of the image).
import sys, os, json, types
import numpy as np
import cv2

# gradio_pipeline imports gradio only for its error type; stub it.
gr = types.ModuleType('gradio')
class _Err(Exception):
    def __init__(self, msg='', duration=None): super().__init__(msg)
gr.Error = _Err
gr.Info = lambda *a, **k: None
gr.update = lambda **k: k
sys.modules['gradio'] = gr

import time
import torch
torch.set_num_threads(os.cpu_count() or 4)
import tyro
from src.config.argument_config import ArgumentConfig
from src.config.inference_config import InferenceConfig
from src.config.crop_config import CropConfig
from src.gradio_pipeline import GradioPipeline

def partial_fields(cls, kwargs):
    return cls(**{k: v for k, v in kwargs.items() if hasattr(cls, k)})

src_dir, out_dir = sys.argv[1], sys.argv[2]
only = sys.argv[3:]  # optional subset of file stems
os.makedirs(out_dir, exist_ok=True)

args = ArgumentConfig()
args.flag_force_cpu = True
args.flag_use_half_precision = False  # fp16 on a CPU is ~100x slower
pipe = GradioPipeline(inference_cfg=partial_fields(InferenceConfig, args.__dict__),
                      crop_cfg=partial_fields(CropConfig, args.__dict__), args=args)
SCALE = 2.3

# Analysing the portrait (face detection, features) is the slow part and is
# the same for every frame — do it once per image. Hand out copies: the
# expression tensor is edited in place by the lip/smile sliders.
import torch
_prep_cache = {}
_prep = pipe.prepare_retargeting_image
def _cached_prepare(input_image, *a, **k):
    if input_image not in _prep_cache:
        _prep_cache.clear()
        _prep_cache[input_image] = _prep(input_image, *a, **k)
    r = _prep_cache[input_image]
    return tuple({kk: (vv.clone() if torch.is_tensor(vv) else vv) for kk, vv in x.items()} if isinstance(x, dict)
                 else (x.clone() if torch.is_tensor(x) else x) for x in r)
pipe.prepare_retargeting_image = _cached_prepare

def render(path, eye, lip, smile=0.0, pursing=0.0, opn=0.0):
    t0 = time.time()
    _, full = pipe.execute_image_retargeting(
        eye, lip, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        0.0, pursing, 0.0, opn, smile, 0.0, 0.0, 0.0, 0.0,
        path, SCALE)
    print(f'  frame eye={eye:.2f} lip={lip:.2f} in {time.time() - t0:.0f}s', flush=True)
    return full  # RGB uint8, full image

def bbox(a, b, thr=24, pad=14):
    # Where the two renders really differ — ignoring the faint re-render
    # noise spread over the whole face (blur, threshold, remove specks).
    d = np.abs(cv2.GaussianBlur(a, (5, 5), 0).astype(np.int16) - cv2.GaussianBlur(b, (5, 5), 0).astype(np.int16)).max(axis=2)
    m = cv2.morphologyEx((d > thr).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    ys, xs = np.where(m > 0)
    if not len(xs):
        return None
    h, w = d.shape
    return [max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + pad), min(h, ys.max() + pad)]

manifest = {}
for name in sorted(os.listdir(src_dir)):
    stem, ext = os.path.splitext(name)
    if ext.lower() not in ('.jpg', '.jpeg', '.png') or (only and stem not in only):
        continue
    path = os.path.join(src_dir, name)
    orig = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    eye0, lip0 = pipe.init_retargeting_image(SCALE, 0.0, 0.0, path)
    print(name, 'source eye', eye0, 'lip', lip0, flush=True)
    frames = {'base': render(path, eye0, lip0)}
    for i, lip in enumerate([0.0, 0.16, 0.3, 0.44, 0.58]):
        frames[f'm{i}'] = render(path, eye0, lip)
    frames['mo'] = render(path, eye0, 0.32, pursing=12.0)
    frames['e1'] = render(path, eye0 * 0.45, lip0)
    frames['e2'] = render(path, 0.0, lip0)

    base = frames['base']
    h, w = base.shape[:2]
    oh, ow = orig.shape[:2]
    entry = {'w': w, 'h': h, 'frames': {}}
    rects = {'base': bbox(base, orig[:h, :w], thr=10, pad=24)}
    mouth = None
    for k in ['m0', 'm1', 'm2', 'm3', 'm4', 'mo']:
        r = bbox(frames[k], base)
        if r:
            mouth = r if mouth is None else [min(mouth[0], r[0]), min(mouth[1], r[1]), max(mouth[2], r[2]), max(mouth[3], r[3])]
    eyes = None
    for k in ['e1', 'e2']:
        r = bbox(frames[k], base)
        if r:
            eyes = r if eyes is None else [min(eyes[0], r[0]), min(eyes[1], r[1]), max(eyes[2], r[2]), max(eyes[3], r[3])]
    for k in ['m0', 'm1', 'm2', 'm3', 'm4', 'mo']:
        rects[k] = mouth
    for k in ['e1', 'e2']:
        rects[k] = eyes
    for k, img in frames.items():
        r = rects[k]
        if not r:
            continue
        x0, y0, x1, y1 = [int(v) for v in r]
        crop = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_RGB2BGR)
        cv2.imwrite(os.path.join(out_dir, f'{stem}-{k}.webp'), crop, [cv2.IMWRITE_WEBP_QUALITY, 90])
        entry['frames'][k] = [round(x0 / w, 4), round(y0 / h, 4), round((x1 - x0) / w, 4), round((y1 - y0) / h, 4)]
        # full frames for visual checking
        cv2.imwrite(os.path.join(out_dir, '_full', f'{stem}-{k}.jpg'), cv2.cvtColor(img, cv2.COLOR_RGB2BGR)) if os.path.isdir(os.path.join(out_dir, '_full')) else None
    manifest[stem] = entry
    print(stem, json.dumps(entry['frames']), flush=True)

with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
