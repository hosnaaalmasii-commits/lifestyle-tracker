import { levelProgress, levelTitle } from './gamification'
import { currentWeekKeys, humanDate } from './dates'

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawWeeklySummaryCard(data, xp) {
  const W = 1080
  const H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const c = data.settings.colors

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#20261c')
  bg.addColorStop(1, '#14180f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const weekKeys = currentWeekKeys()
  const waterHits = weekKeys.filter((k) => (data.water[k] || 0) >= data.settings.waterGoalMl).length
  const sleepHits = weekKeys.filter((k) => (data.sleep[k]?.hours || 0) >= data.settings.sleepGoalHours).length
  const workoutHits = weekKeys.filter((k) => data.workouts.completions[k]).length
  const { level } = levelProgress(xp)

  ctx.fillStyle = '#ede9da'
  ctx.font = '600 40px Inter, sans-serif'
  ctx.fillText('MY WEEK', 72, 120)
  ctx.font = '600 64px Georgia, serif'
  ctx.fillText(`${humanDate(weekKeys[0])} – ${humanDate(weekKeys[6])}`, 72, 200)

  ctx.fillStyle = c.accent
  ctx.font = '700 34px Inter, sans-serif'
  ctx.fillText(`Level ${level} · ${levelTitle(level)}`, 72, 270)

  const stats = [
    { label: 'Water goal met', value: `${waterHits}/7`, color: c.water },
    { label: 'Sleep goal met', value: `${sleepHits}/7`, color: c.sleep },
    { label: 'Workouts done', value: `${workoutHits}/7`, color: c.workout },
  ]

  let y = 360
  for (const s of stats) {
    roundRect(ctx, 72, y, W - 144, 150, 28)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()

    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(140, y + 75, 16, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ede9da'
    ctx.font = '500 34px Inter, sans-serif'
    ctx.fillText(s.label, 180, y + 65)

    ctx.font = '700 56px Inter, sans-serif'
    ctx.fillText(s.value, 180, y + 122)
    y += 180
  }

  ctx.fillStyle = 'rgba(237,233,218,0.55)'
  ctx.font = '500 28px Inter, sans-serif'
  ctx.fillText('Lifestyle Tracker', 72, H - 60)

  return canvas
}

export async function shareOrDownloadCanvas(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Week' })
      return
    } catch {
      // fall through to download if the user cancels or share fails
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
