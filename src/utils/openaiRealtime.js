// Live, interruptible voice conversations with the coach through OpenAI's
// Realtime API — the counterpart of elevenAgent.js for users whose coach
// voice is OpenAI (added 2026-10-01 so the user can compare both: "als ik
// kies voor openai dat ik live gesprekken kan doen").
//
// Bring-your-own-key like openaiTts.js: the user's key mints a short-lived
// client secret (/v1/realtime/client_secrets, with the coach prompt, voice
// and speed baked into the session), and the browser then talks to OpenAI
// directly over WebRTC (/v1/realtime/calls). Audio in and out, speech
// detection and interruptions are all handled by OpenAI.

import { getOpenAiKey, getOpenAiVoice } from './openaiTts'

const API = 'https://api.openai.com/v1'
// The smaller realtime model: a fraction of gpt-realtime's price and quick
// enough for short spoken coaching answers.
export const REALTIME_MODEL = 'gpt-realtime-mini'
// Voices the realtime models offer (the TTS-only ones fall back to marin).
const REALTIME_VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'])

export class OpenAiLiveError extends Error {}

async function explain(res, what) {
  let detail = ''
  try { detail = (await res.json())?.error?.message || '' } catch { /* not JSON */ }
  if (res.status === 401) return `OpenAI weigert de sleutel bij ${what}. Controleer hem bij Coach instellen → Stem.`
  if (res.status === 403) return `OpenAI: je sleutel of project heeft geen toegang tot live spraak (Realtime)${detail ? ` — ${detail}` : ''}.`
  if (res.status === 429) return 'OpenAI: tegoed op of te veel verzoeken. Kijk op platform.openai.com → Billing.'
  return `OpenAI-fout ${res.status} bij ${what}${detail ? `: ${detail}` : ''}`
}

/**
 * Same contract as startLiveCoach (elevenAgent.js): resolves to an object
 * with endSession(); callbacks onMode('listening'|'speaking'),
 * onUserText, onAgentText, onEnd(reason|null), onError(message).
 * micStream: a microphone stream asked for inside the tap (it's used and
 * stopped by the session). audioEl: an <audio> element made inside the tap,
 * so iOS lets it play.
 */
export async function startOpenAiLive({ prompt, firstMessage = '', speed = 1, micStream, audioEl, onMode, onUserText, onAgentText, onEnd, onError }) {
  const chosen = getOpenAiVoice()
  const voice = REALTIME_VOICES.has(chosen) ? chosen : 'marin'
  const session = {
    type: 'realtime',
    model: REALTIME_MODEL,
    instructions: prompt,
    audio: {
      input: {
        transcription: { model: 'gpt-4o-mini-transcribe' },
        // Waits for a finished thought, not just a pause.
        turn_detection: { type: 'semantic_vad', eagerness: 'auto' },
        noise_reduction: { type: 'near_field' },
      },
      output: { voice, speed: Math.min(1.5, Math.max(0.25, speed)) },
    },
  }

  const releaseMic = () => micStream?.getTracks().forEach((t) => t.stop())
  let res
  try {
    res = await fetch(`${API}/realtime/client_secrets`, {
      method: 'POST',
      headers: { authorization: `Bearer ${getOpenAiKey()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ session }),
    })
  } catch {
    releaseMic()
    throw new OpenAiLiveError('Kon OpenAI niet bereiken — ben je online?')
  }
  if (!res.ok) { releaseMic(); throw new OpenAiLiveError(await explain(res, 'het starten van het gesprek')) }
  const { value: secret } = await res.json()

  const stream = micStream || await navigator.mediaDevices.getUserMedia({ audio: true })
  const player = audioEl || new Audio()
  player.autoplay = true
  player.setAttribute?.('playsinline', '')

  const pc = new RTCPeerConnection()
  let ended = false
  const end = (reason) => {
    if (ended) return
    ended = true
    try { dc.close() } catch { /* already closed */ }
    try { pc.close() } catch { /* already closed */ }
    stream.getTracks().forEach((t) => t.stop())
    player.srcObject = null
    onEnd?.(reason)
  }

  pc.ontrack = (e) => {
    player.srcObject = e.streams[0]
    player.play?.().catch(() => {})
  }
  stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream))
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') end('De verbinding met OpenAI viel weg.')
  }

  const dc = pc.createDataChannel('oai-events')
  dc.onopen = () => {
    if (firstMessage) {
      dc.send(JSON.stringify({ type: 'response.create', response: { instructions: `Greet the user with exactly this sentence, warmly: "${firstMessage}"` } }))
    }
  }
  dc.onmessage = (e) => {
    let event
    try { event = JSON.parse(e.data) } catch { return }
    switch (event.type) {
      case 'output_audio_buffer.started': onMode?.('speaking'); break
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
      case 'input_audio_buffer.speech_started': onMode?.('listening'); break
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript?.trim()) onUserText?.(event.transcript.trim())
        break
      case 'response.output_audio_transcript.done':
        if (event.transcript?.trim()) onAgentText?.(event.transcript.trim())
        break
      case 'error':
        onError?.(event.error?.message || 'Er ging iets mis in het live-gesprek.')
        break
      default:
        break
    }
  }

  try {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    const answer = await fetch(`${API}/realtime/calls`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/sdp' },
      body: offer.sdp,
    })
    if (!answer.ok) throw new OpenAiLiveError(await explain(answer, 'het verbinden'))
    await pc.setRemoteDescription({ type: 'answer', sdp: await answer.text() })
  } catch (e) {
    ended = true
    try { pc.close() } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop())
    if (e instanceof OpenAiLiveError) throw e
    throw new OpenAiLiveError(`Live-gesprek starten mislukt${e?.message ? `: ${e.message.replace(/\.+$/, '')}` : ''}.`)
  }

  return { endSession: () => end(null) }
}
