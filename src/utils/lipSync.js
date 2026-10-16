// How open the coach's mouth should be right now, 0–1, plus which mouth
// shape — for the talking portrait (TalkingFace.jsx). Free and on-device:
//   - cloud voices (OpenAI / ElevenLabs <audio>) and ChatGPT live (a WebRTC
//     stream): the loudness of the actual audio (Web Audio analyser), with
//     the letter being spoken (from the reply's progress) for o/u and
//     m/b/p shapes where that's known;
//   - device voices (no audio access in browsers): estimated from the
//     letter being spoken.
import { getSpeechProgress, getSpeechAudio } from './speechOutput'

let ctx = null
function audioCtx() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  return ctx
}

// Call inside a tap (iOS only lets audio start from one).
export function unlockLipSync() {
  const c = audioCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

function makeAnalyser(node) {
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.35
  node.connect(analyser)
  return { analyser, buf: new Float32Array(analyser.fftSize) }
}

function rms({ analyser, buf }) {
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

// ---- a live conversation (Coach.jsx startLive) ----
// { volume: () => 0–1 } — ElevenLabs' SDK reports its own output volume;
// { audioEl } — OpenAI's reply stream plays in this element (srcObject
// arrives once connected); null — no live conversation.
let liveSrc = null
let liveTap = null
export function setLiveSource(src) {
  liveSrc = src
  liveTap = null
}
function liveLevel() {
  if (!liveSrc) return null
  if (liveSrc.volume) {
    try { return liveSrc.volume() || 0 } catch { return 0 }
  }
  const stream = liveSrc.audioEl?.srcObject
  if (!stream) return 0
  if (!liveTap || liveTap.stream !== stream) {
    const c = audioCtx()
    if (!c) return 0
    try { liveTap = { stream, a: makeAnalyser(c.createMediaStreamSource(stream)) } } catch { return 0 }
  }
  return Math.min(1, rms(liveTap.a) * 9)
}

// ---- the cloud voices' <audio> element ----
// captureStream() taps the audio without rerouting it (Chrome, Edge,
// Firefox). Safari lacks it; there the element is routed through Web
// Audio, but only while the context is running — otherwise the voice
// would go silent.
let el = null
let elTap = null
function elementLevel(audio) {
  if (el !== audio) {
    el = audio
    elTap = null
    const c = audioCtx()
    if (!c) return null
    try {
      const cap = audio.captureStream?.() || audio.mozCaptureStream?.()
      if (cap) elTap = { kind: 'stream', cap, a: null }
      else if (c.state === 'running') {
        const src = c.createMediaElementSource(audio)
        src.connect(c.destination)
        elTap = { kind: 'node', a: makeAnalyser(src) }
      }
    } catch (e) { console.warn('lip sync: audio', e) }
  }
  if (!elTap) return null
  if (elTap.kind === 'stream') {
    // The captured stream gets a (new) track once each clip starts playing.
    const track = elTap.cap.getAudioTracks()[0]
    if (!track) return null
    if (elTap.trackId !== track.id) {
      elTap.trackId = track.id
      try { elTap.a = makeAnalyser(ctx.createMediaStreamSource(new MediaStream([track]))) } catch { elTap.a = null }
    }
  }
  return elTap.a ? rms(elTap.a) : null
}

const ROUND = /[oóòöuúùüwq]/i
const CLOSED = /[mbp]/i
const OPEN = /[aáàäeéèëiíìï]/i

// The letter at the current spoken position, if known.
function currentChar() {
  const p = getSpeechProgress()
  if (!p) return null
  return p.text[Math.floor(p.pos)] || null
}

let smooth = 0
let lastT = 0
/**
 * → { open: 0–1, shape: 'round' | 'closed' | null } for this frame, or
 * null when the coach is silent. Call once per animation frame.
 */
export function mouthNow() {
  const now = performance.now()
  const dt = Math.min(0.1, (now - (lastT || now)) / 1000)
  lastT = now

  let target = null
  let ch = null
  const lv = liveLevel()
  if (lv != null) {
    target = lv > 0.04 ? lv : null
  } else if (getSpeechProgress()) {
    ch = currentChar()
    const audio = getSpeechAudio()
    const lvl = audio ? elementLevel(audio) : null
    if (lvl != null) target = Math.min(1, lvl * 9)
    else {
      // Device voice: a syllable rhythm from the letters, with a little life.
      if (!ch || /[\s.,!?;:]/.test(ch)) target = 0.05
      else if (CLOSED.test(ch)) target = 0.08
      else if (OPEN.test(ch) || ROUND.test(ch)) target = 0.55 + 0.35 * Math.abs(Math.sin(now / 90))
      else target = 0.3 + 0.15 * Math.abs(Math.sin(now / 70))
    }
  }
  if (target == null) {
    smooth = Math.max(0, smooth - dt * 6)
    return smooth > 0.02 ? { open: smooth, shape: null } : null
  }
  // Open fast, close a little slower — like a real jaw.
  const k = target > smooth ? 22 : 12
  smooth += (target - smooth) * Math.min(1, dt * k)
  let shape = null
  if (ch && ROUND.test(ch) && smooth > 0.2) shape = 'round'
  else if (ch && CLOSED.test(ch)) shape = 'closed'
  return { open: smooth, shape }
}
