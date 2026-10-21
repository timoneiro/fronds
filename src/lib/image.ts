/** Downscale a photo onto a canvas, keeping its aspect ratio. Shared by the data-URL and Blob variants. */
async function drawResized(file: File, maxSize: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Downscale a photo to a small JPEG data URL so 50 plants still fit in a backup file. */
export async function resizeImage(file: File, maxSize = 640, quality = 0.8): Promise<string> {
  const canvas = await drawResized(file, maxSize)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Downscale a photo to a JPEG Blob for uploading (e.g. to a plant-ID API). */
export async function resizeImageBlob(file: File, maxSize = 1280, quality = 0.9): Promise<Blob> {
  const canvas = await drawResized(file, maxSize)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      quality,
    )
  })
}
