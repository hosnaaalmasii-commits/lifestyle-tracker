import sharp from 'sharp'
import { readdirSync } from 'fs'
import { join } from 'path'

const dir = join(process.cwd(), 'public', 'wallpapers')
const files = readdirSync(dir).filter((f) => f.endsWith('.jpg'))

for (const file of files) {
  const path = join(dir, file)
  const buf = await sharp(path).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()
  const tmp = path + '.tmp'
  await sharp(buf).toFile(tmp)
  const { renameSync, unlinkSync } = await import('fs')
  unlinkSync(path)
  renameSync(tmp, path)
  console.log(file, buf.length, 'bytes')
}
