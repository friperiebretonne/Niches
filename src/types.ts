export type Gender = 'homme' | 'femme' | 'unisexe'

export const GENDER_LABELS: Record<Gender, string> = { homme: 'Homme', femme: 'Femme', unisexe: 'Unisexe' }

export interface Photo {
  id: string
  item_id: string
  path: string
  position: number
}

export interface Item {
  id: string
  brand: string
  model: string
  new_price: number | null
  resale_price: number
  max_buy_price: number
  material: string | null
  made_in: string | null
  gender: Gender | null
  notes: string | null
  created_at: string
  updated_at: string
  item_photos: Photo[]
}

export interface ItemDraft {
  brand: string
  model: string
  new_price: number | null
  resale_price: number
  material: string | null
  made_in: string | null
  gender: Gender | null
  notes: string | null
}

/** Résultat de recherche : la fiche et, pour une recherche photo, sa ressemblance (0 à 1). */
export interface SearchHit {
  item: Item
  similarity?: number
}

/** Photo ajoutée dans le formulaire, pas encore envoyée. */
export interface PendingPhoto {
  key: string
  blob: Blob
  previewUrl: string
}
