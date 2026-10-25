const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

export const formatPrice = (n: number | null | undefined) => (n == null ? '–' : euros.format(n))

export const MAX_BUY_DIVISOR = 2.2

export const maxBuyPrice = (resale: number) => Math.round((resale / MAX_BUY_DIVISOR) * 100) / 100

/** Traduit la ressemblance CLIP (0 à 1) en un libellé lisible. */
export function similarityLabel(s: number): { label: string; level: 'high' | 'mid' | 'low' } {
  if (s >= 0.9) return { label: 'Très proche', level: 'high' }
  if (s >= 0.82) return { label: 'Proche', level: 'mid' }
  return { label: 'Ressemblant', level: 'low' }
}
