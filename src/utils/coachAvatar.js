// The coach's face. data.settings.coachAvatar is one of:
//   { type: 'preset', id }       — one of COACH_PRESETS (public/coaches/)
//   { type: 'photo', image }     — the user's own upload (3:4 JPEG data URL)
//   null                         — the original glowing orb
//
// Tried and rejected first (2026-09-30): drawn DiceBear avatars ("te
// cartoon"), a free talking 3D person ("niet mooi") and a round-cropped
// photo ("te koud"). What stuck came from the user's own reference image:
// a realistic person, waist-up, in warm clothes, standing in a glass arch
// on a deep purple backdrop (CoachPortrait.jsx). Nothing paid, so the face
// doesn't move its lips — it breathes and glows while speaking instead.
//
// Presets are AI-generated people (no real person's likeness) from
// Pixabay, free under the Pixabay Content License — no attribution needed.
// The user picked these six from a gallery. pos = object-position for the
// arch crop; face = [x%, y%] of the face, for the small round avatar.

const base = import.meta.env.BASE_URL

export const COACH_PRESETS = [
  { id: 'sofie', name: 'Sofie', file: '8946672.jpg', pos: '50% 20%', face: [50, 38] },
  { id: 'lina', name: 'Lina', file: '9144811.jpg', pos: '58% 10%', face: [60, 22] },
  { id: 'lucas', name: 'Lucas', file: '8921611.jpg', pos: '50% 10%', face: [45, 25] },
  { id: 'daan', name: 'Daan', file: '9009344.jpg', pos: '50% 10%', face: [52, 30] },
  { id: 'sem', name: 'Sem', file: '9011894.jpg', pos: '50% 10%', face: [50, 26] },
  { id: 'thomas', name: 'Thomas', file: '9274257.jpg', pos: '70% 10%', face: [66, 22] },
].map((p) => ({ ...p, src: `${base}coaches/${p.file}` }))

// → { src, pos, face, name } for whatever face is chosen, or null (orb).
export function coachImage(avatar) {
  if (avatar?.type === 'preset') {
    const p = COACH_PRESETS.find((x) => x.id === avatar.id)
    return p ? { src: p.src, pos: p.pos, face: p.face, name: p.name, key: p.file.replace('.jpg', '') } : null
  }
  if (avatar?.type === 'photo' && avatar.image) {
    return { src: avatar.image, pos: '50% 15%', face: [50, 28], name: null, key: null }
  }
  return null
}

// A 3:4 portrait crop of an uploaded photo, biased towards the top (where
// the face is), downscaled to keep the synced data small.
export function photoFromFile(file, width = 600) {
  const height = Math.round(width * 4 / 3)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Kon de afbeelding niet lezen.'))
      img.onload = () => {
        const ratio = 3 / 4
        let sw = img.width
        let sh = img.width / ratio
        if (sh > img.height) { sh = img.height; sw = sh * ratio }
        const sx = (img.width - sw) / 2
        const sy = (img.height - sh) * 0.1
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// For making your own portrait with a free AI image generator (ChatGPT,
// Copilot, Gemini) in the same style as the presets.
export const PORTRAIT_PROMPT = 'Photorealistic waist-up portrait of a calm, warm and friendly personal health coach, wearing a soft warm-coloured knit sweater, gentle genuine smile, looking into the camera, soft studio light, plain deep purple background, classy and reassuring. Portrait format 3:4.'
