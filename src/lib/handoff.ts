// Photo transmise de la recherche au formulaire « Créer une fiche avec cette photo ».
let pending: Blob | null = null

export const handOffPhoto = (blob: Blob) => {
  pending = blob
}

export const takeHandedOffPhoto = () => {
  const blob = pending
  pending = null
  return blob
}
