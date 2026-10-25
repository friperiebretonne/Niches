const MAX_SIDE = 900
const QUALITY = 0.78

/** Redimensionne et compresse une image en WebP (environ 60 à 120 Ko) avant envoi. */
export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
  // Safari ancien ne sait pas produire du WebP : repli en JPEG.
  if (blob && blob.type === 'image/webp') return blob
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', QUALITY),
  )
}

/** Récupère les images d'un événement coller (Ctrl+V) ou glisser-déposer. */
export function imagesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((f) => f.type.startsWith('image/'))
}
