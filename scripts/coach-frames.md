# Coach mouth / blink frames

`public/coaches/frames/*.webp` + `src/data/coachFrames.json` are rendered
once from the preset portraits in `public/coaches/` with
[LivePortrait](https://github.com/KwaiVGI/LivePortrait)'s single-image
retargeting (`coach_frames.py`, CPU is fine — a few minutes per coach).
`TalkingFace.jsx` cross-fades them in the browser, driven by the voice
(`utils/lipSync.js`). Nothing runs at app time except the cross-fade.

To add or redo a coach:

```
git clone --depth 1 https://github.com/KwaiVGI/LivePortrait.git
cd LivePortrait
uv venv --python 3.10 .venv
uv pip install --python .venv/Scripts/python.exe torch==2.3.0 torchvision==0.18.0 --index-url https://download.pytorch.org/whl/cpu
# requirements_base.txt minus gradio; albucore pinned (newer ones need a compiler)
uv pip install --python .venv/Scripts/python.exe -r req_cpu.txt onnxruntime "numpy<2" "huggingface_hub[cli]<1.0" --override over.txt   # over.txt: albucore==0.0.13
.venv/Scripts/huggingface-cli download KwaiVGI/LivePortrait --local-dir pretrained_weights --exclude "*.git*" README.md docs
cp <repo>/scripts/coach_frames.py .
.venv/Scripts/python coach_frames.py <repo>/public/coaches <out> [file-stem ...]
```

Then copy `<out>/*.webp` to `public/coaches/frames/` and merge
`<out>/manifest.json` into `src/data/coachFrames.json` (keyed by the
portrait's file stem). Delete the LivePortrait folder afterwards (~3 GB).
