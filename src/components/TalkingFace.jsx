import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import FRAMES from '../data/coachFrames.json'
import { mouthNow } from '../utils/lipSync'

const base = import.meta.env.BASE_URL
const MOUTHS = ['m0', 'm1', 'm2', 'm3', 'm4']
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The coach's photo, filling its frame like object-fit: cover — and for the
// preset coaches, alive: lips moving with the voice, blinking, a slow
// breathing sway and small nods while talking. The mouth and eye shapes are
// real renders of that same photo (made once with LivePortrait,
// scripts/coach-frames.md), cropped to the mouth/eyes and cross-faded here
// at 60 fps by lipSync.js's mouthNow() — no video, no paid service.
// An own uploaded photo has no renders and just sways and breathes.
export default function TalkingFace({ img }) {
  const boxRef = useRef(null)
  const innerRef = useRef(null)
  const layers = useRef({})
  const [box, setBox] = useState(null)
  const man = img.key ? FRAMES[img.key] : null

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Lips + nods.
  useEffect(() => {
    if (!man) return undefined
    let raf = 0
    const still = reducedMotion()
    const tick = () => {
      const m = mouthNow()
      const L = layers.current
      const open = m ? m.open : 0
      const show = !!m
      const f = Math.min(3.999, Math.max(0, open * 4.6 - 0.3))
      const lo = Math.floor(f)
      MOUTHS.forEach((k, i) => {
        if (!L[k]) return
        L[k].style.opacity = !show ? 0 : i === lo ? 1 : i === lo + 1 ? (f - lo).toFixed(3) : 0
      })
      if (L.mo) L.mo.style.opacity = show && m.shape === 'round' ? Math.min(1, open * 1.6).toFixed(3) : 0
      if (L.m0 && show && m.shape === 'closed') L.m0.style.opacity = 1
      if (innerRef.current && !still) {
        const t = performance.now()
        innerRef.current.style.transform = show
          ? `translateY(${(-open * 1.4).toFixed(2)}px) rotate(${(Math.sin(t / 1300) * 0.5 + open * 0.25).toFixed(3)}deg)`
          : ''
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [man])

  // Blinking, every 2.5–6 seconds.
  useEffect(() => {
    if (!man?.frames.e2) return undefined
    let timer = 0
    const set = (k1, k2) => {
      const L = layers.current
      if (L.e1) L.e1.style.opacity = k1
      if (L.e2) L.e2.style.opacity = k2
    }
    const blink = () => {
      set(1, 0)
      setTimeout(() => set(0, 1), 55)
      setTimeout(() => set(1, 0), 150)
      setTimeout(() => set(0, 0), 210)
      timer = setTimeout(blink, 2500 + Math.random() * 3500)
    }
    timer = setTimeout(blink, 1200 + Math.random() * 2000)
    return () => clearTimeout(timer)
  }, [man])

  // object-fit: cover, positioned by img.pos ("50% 20%").
  let inner = { position: 'absolute', inset: 0 }
  if (box && man) {
    const s = Math.max(box.w / man.w, box.h / man.h)
    const iw = man.w * s
    const ih = man.h * s
    const [px, py] = (img.pos || '50% 50%').split(' ').map((v) => parseFloat(v) / 100)
    inner = { position: 'absolute', left: (box.w - iw) * px, top: (box.h - ih) * py, width: iw, height: ih }
  }

  return (
    <div ref={boxRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div className="coach-sway" style={{ position: 'absolute', inset: 0 }}>
        {man ? (
          <div ref={innerRef} style={{ ...inner, transformOrigin: '50% 85%', willChange: 'transform' }}>
            <img src={img.src} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            {Object.entries(man.frames).map(([k, [x, y, w, h]]) => (
              <img
                key={k}
                ref={(el) => { layers.current[k] = el }}
                src={`${base}coaches/frames/${img.key}-${k}.webp`}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
                  opacity: k === 'base' ? 1 : 0, pointerEvents: 'none',
                  // Soft edges so a shape blends into the face around it.
                  ...(k === 'base' ? {} : { WebkitMaskImage: FEATHER, maskImage: FEATHER }),
                }}
              />
            ))}
          </div>
        ) : (
          <img src={img.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: img.pos }} />
        )}
      </div>
    </div>
  )
}

const FEATHER = 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)'
