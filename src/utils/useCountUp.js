import { useEffect, useRef, useState } from 'react'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Animates a number from where it was (0 on first show) to `target` with
// an ease-out curve — for score percentages and stat values. Returns the
// in-between number; format it yourself.
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(reduceMotion() ? target : 0)
  const fromRef = useRef(reduceMotion() ? target : 0)

  useEffect(() => {
    // No animation frames arrive while the page is hidden — jump straight
    // to the value then, so a number can never get stuck mid-count.
    if (reduceMotion() || !Number.isFinite(target) || document.visibilityState === 'hidden') {
      setValue(target); fromRef.current = target; return
    }
    const from = fromRef.current
    const start = performance.now()
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (target - from) * eased
      setValue(v)
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frame = requestAnimationFrame(tick)
    // Safety net: whatever happens to frames, land on the exact value.
    const done = setTimeout(() => { setValue(target); fromRef.current = target }, duration + 150)
    return () => { cancelAnimationFrame(frame); clearTimeout(done); fromRef.current = target }
  }, [target, duration])

  return value
}
