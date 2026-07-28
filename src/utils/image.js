// Resize an image file client-side and return a base64 JPEG data URL,
// so progress photos stay reasonably small in localStorage.
export function resizeImageToDataUrl(file, maxDim = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read image'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width, height })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
