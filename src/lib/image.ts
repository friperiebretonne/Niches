const MAX_SIDE = 900
const QUALITY = 0.78

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

/**
 * Décode une image. createImageBitmap échoue sur certains fichiers (WebP enregistrés depuis Vinted,
 * types mal déclarés…) : on se rabat alors sur un élément <img>, plus tolérant.
 */
async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      URL.revokeObjectURL(url)
      throw new Error("Ce fichier image n'a pas pu être lu. Essayez une capture d'écran de la photo.")
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  }
}

/** Redimensionne et compresse une image en WebP (environ 60 à 120 Ko). */
export async function compressImage(file: Blob): Promise<Blob> {
  const img = await decode(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
  const width = Math.round(img.width * scale)
  const height = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(img.source, 0, 0, width, height)
  img.release()
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
  return Array.from(data.files).filter((f) => f.type.startsWith('image/') || /\.(webp|avif|jpe?g|png|gif|heic)$/i.test(f.name))
}
