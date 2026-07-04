/**
 * Comprime una foto en el cliente antes de subirla: redimensiona a máx.
 * `maxDim` px el lado mayor y exporta a WebP. Una foto de móvil de ~6 MB
 * queda en 150-300 KB.
 */
export async function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.8,
): Promise<Blob> {
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.drawImage(bitmap, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  )
  if (!blob) throw new Error('No se pudo comprimir la imagen')
  return blob
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // from-image respeta la orientación EXIF de la cámara
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // safari antiguo: caemos al <img>
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Imagen ilegible'))
      img.src = url
    })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
