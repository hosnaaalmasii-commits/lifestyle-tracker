// "Ears" for the coach that don't depend on the browser's SpeechRecognition:
// record the microphone ourselves (MediaRecorder) and have the clip
// transcribed by OpenAI or ElevenLabs — whichever key the user already has
// for the coach's voice. Added 2026-10-01 because iOS's built-in
// recognition often gets no audio at all (notably from the home-screen
// app): "hij zegt dat hij niks hoort", even when started from a tap.
//
// Same trust model as those keys: the clip goes straight from this browser
// to that service, nothing is stored.

import { getOpenAiKey, hasOpenAiKey } from './openaiTts'
import { getElevenKey, hasElevenKey } from './elevenLabs'

export class TranscribeError extends Error {}

export function canRecord() {
  return typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
}

export function cloudEarsAvailable() {
  return canRecord() && (hasOpenAiKey() || hasElevenKey())
}

function pickMime() {
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']) {
    if (window.MediaRecorder.isTypeSupported?.(type)) return type
  }
  return ''
}

/**
 * Starts recording right away — call it inside the tap (iOS only lets an
 * AudioContext run when it was created in one). Ends by itself SILENCE_MS
 * after the user stops talking, after NO_SPEECH_MS of nothing, or at
 * MAX_MS. Returns { done: Promise<Blob|null>, stop() } — `done` resolves to
 * null when no speech was detected; stop() ends it now (keeping what was
 * said). onSpeech() fires once, when talking is first detected.
 */
export function startRecording({ onSpeech, onLevel, onInfo, silenceMs = 1300, noSpeechMs = 8000, maxMs = 20000 } = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const audioCtx = Ctx ? new Ctx() : null
  audioCtx?.resume?.()
  let stopNow = () => {}
  let stopped = false
  const stop = () => { stopped = true; stopNow() }

  const done = (async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      audioCtx?.close?.()
      throw new TranscribeError(e?.name === 'NotAllowedError'
        ? 'De microfoon is geblokkeerd. Zet hem aan via Instellingen → Safari (of de app) → Microfoon.'
        : 'Kon de microfoon niet starten.')
    }
    const mime = pickMime()
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }

    // Voice activity from the input level: a noise floor measured in the
    // first moments, "talking" well above it. The meter is only used to
    // stop automatically — the clip is always sent (if long enough), since
    // on some iPhones the meter reads near-silence while the mic works
    // fine. A meter that reads (almost) nothing never ends the turn; then
    // a tap does, or maxMs.
    let heardSpeech = false
    let lastLoud = 0
    let floor = null
    let peak = 0
    const started = performance.now()
    let analyser = null
    let buf = null
    if (audioCtx) {
      const source = audioCtx.createMediaStreamSource(stream)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      buf = new Float32Array(analyser.fftSize)
    }

    const result = new Promise((resolve) => {
      let timer = null
      const finish = () => {
        clearInterval(timer)
        if (recorder.state !== 'inactive') recorder.stop()
        else resolve(null)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop()) // gives the speaker back on iOS
        audioCtx?.close?.()
        const type = recorder.mimeType || mime || 'audio/mp4'
        const seconds = (performance.now() - started) / 1000
        const blob = chunks.length && seconds > 0.8 ? new Blob(chunks, { type }) : null
        onInfo?.({ seconds, peak, heardSpeech, bytes: blob?.size || 0, type })
        resolve(blob)
      }
      stopNow = finish
      recorder.start(250)
      if (stopped) { finish(); return }
      timer = setInterval(() => {
        const now = performance.now()
        if (analyser) {
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
          const rms = Math.sqrt(sum / buf.length)
          peak = Math.max(peak, rms)
          onLevel?.(rms)
          if (now - started < 300) { floor = floor === null ? rms : Math.min(floor, rms); return }
          const threshold = Math.min(0.04, Math.max(0.008, (floor || 0) * 3))
          if (rms > threshold) {
            if (!heardSpeech) { heardSpeech = true; onSpeech?.() }
            lastLoud = now
          }
          const meterWorks = peak > 0.002
          if (heardSpeech && now - lastLoud > silenceMs) return finish()
          if (!heardSpeech && meterWorks && now - started > noSpeechMs) return finish()
        }
        if (now - started > maxMs) finish()
      }, 100)
    })
    return result
  })()

  return { done, stop }
}

function extFor(type) {
  if (/webm/.test(type)) return 'webm'
  if (/aac/.test(type)) return 'aac'
  return 'm4a'
}

async function transcribeOpenAi(blob, lang) {
  const form = new FormData()
  form.append('file', blob, `spraak.${extFor(blob.type)}`)
  form.append('model', 'gpt-4o-mini-transcribe')
  if (lang) form.append('language', lang.split('-')[0])
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${getOpenAiKey()}` },
    body: form,
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error?.message || '' } catch { /* not JSON */ }
    if (res.status === 401) throw new TranscribeError('OpenAI weigert de sleutel — controleer hem bij Coach instellen → Stem.')
    if (res.status === 429) throw new TranscribeError('OpenAI: tegoed op of te veel verzoeken.')
    throw new TranscribeError(`OpenAI-fout ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return (await res.json())?.text || ''
}

async function transcribeEleven(blob, lang) {
  const form = new FormData()
  form.append('file', blob, `spraak.${extFor(blob.type)}`)
  form.append('model_id', 'scribe_v1')
  if (lang) form.append('language_code', lang.split('-')[0])
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': getElevenKey() },
    body: form,
  })
  if (!res.ok) {
    if (res.status === 401) throw new TranscribeError('ElevenLabs weigert de sleutel voor spraakherkenning — geef de sleutel ook het recht "Speech to Text".')
    if (res.status === 429) throw new TranscribeError('ElevenLabs: tegoed op of te veel verzoeken.')
    throw new TranscribeError(`ElevenLabs-fout ${res.status}`)
  }
  return (await res.json())?.text || ''
}

// → the spoken text ('' when nothing intelligible was said).
export async function transcribe(blob, lang) {
  try {
    const text = hasOpenAiKey() ? await transcribeOpenAi(blob, lang) : await transcribeEleven(blob, lang)
    return text.trim()
  } catch (e) {
    if (e instanceof TranscribeError) throw e
    throw new TranscribeError('Kon de opname niet laten uitschrijven — ben je online?')
  }
}
