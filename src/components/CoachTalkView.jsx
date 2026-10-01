import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { coachImage } from '../utils/coachAvatar'
import { getSpeechProgress } from '../utils/speechOutput'
import { ORB_BACKGROUND } from './CoachAvatar'
import Icon from './Icon'
import { tx } from '../i18n/tx'

// The live, spoken conversation — full screen, like a calm video call:
// the coach large in the middle (slow drift/zoom, breathing, glowing while
// speaking, a soft ring while listening), and underneath the words being
// typed out: what you say as you say it, and the coach's reply in step
// with its voice (speechOutput's progress; a steady typewriter otherwise).
// Rendered through a portal to <body> like every overlay here (Sheet.jsx
// explains why position:fixed can't live inside .page).
export default function CoachTalkView({ open, avatar, name, state, heard, reply, error, diag, tapToFinish, onTapCoach, onStop }) {
  const img = coachImage(avatar)
  const shown = useTypedReply(reply, state === 'speaking' && open)
  if (!open) return null

  const status = {
    listening: tapToFinish ? tx("Ik luister… tik op mij als je klaar bent") : tx("Ik luister…"),
    thinking: tx("Even denken…"),
    speaking: '',
    idle: name ? `${tx("Tik op")} ${name} ${tx("om te praten")}` : tx("Tik op je coach om te praten"),
  }[state] ?? ''
  const width = 'min(68vw, 300px)'

  return createPortal(
    <div className="talk-view" role="dialog" aria-label={tx("Gesprek met je coach")}>
      <div className="talk-top">
        <span className="text-sm muted">{name || tx("Je coach")}</span>
      </div>

      <button
        type="button"
        onClick={state === 'thinking' ? undefined : onTapCoach}
        aria-label={status || tx("Tik om te onderbreken")}
        className={`talk-portrait ${state}`}
        style={{
          width,
          aspectRatio: img ? '1 / 1.3' : '1 / 1',
          borderRadius: img ? 'min(34vw, 150px) min(34vw, 150px) 28px 28px' : '50%',
          background: img ? 'radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--accent) 45%, #2a1f5c) 0%, #1c1640 70%)' : ORB_BACKGROUND,
        }}
      >
        {img && <img src={img.src} alt="" className="talk-portrait-img" style={{ objectPosition: img.pos }} />}
        {img && <span aria-hidden className="talk-portrait-glass" />}
      </button>

      <div className="talk-captions">
        {state === 'listening' && (
          <p className="talk-you">{heard || <span className="muted">{status}</span>}</p>
        )}
        {state === 'thinking' && (
          <p className="talk-status"><span className="talk-dots"><i /><i /><i /></span></p>
        )}
        {state === 'speaking' && <p className="talk-coach">{shown}<span className="talk-caret" /></p>}
        {state === 'idle' && <p className="talk-status muted">{status}</p>}
        {error && <p className="text-sm" style={{ color: 'var(--danger)', margin: '10px 0 0' }}>{error}</p>}
        {diag && <p className="faint" style={{ fontSize: 11, margin: '10px 0 0', opacity: 0.7 }}>{diag}</p>}
      </div>

      <button type="button" className="talk-stop" onClick={onStop} aria-label={tx("Gesprek stoppen")}>
        <Icon name="close" size={22} />
      </button>
    </div>,
    document.body,
  )
}

// The reply, revealed in step with the voice when progress is known,
// otherwise at a steady ~28 characters a second.
function useTypedReply(text, active) {
  const [shown, setShown] = useState('')
  const startRef = useRef(0)
  useEffect(() => {
    if (!active || !text) { setShown(active ? '' : text || ''); return undefined }
    startRef.current = performance.now()
    let raf = 0
    const tick = () => {
      const prog = getSpeechProgress()
      let n
      if (prog && prog.text.length) {
        n = Math.ceil(((prog.pos + 1) / prog.text.length) * text.length)
      } else {
        n = Math.floor(((performance.now() - startRef.current) / 1000) * 28)
      }
      setShown(text.slice(0, Math.min(text.length, n)))
      if (n < text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, active])
  return shown
}
