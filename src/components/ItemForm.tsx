import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Item, PendingPhoto } from '../types'
import { getItem, listBrands, saveItem } from '../lib/api'
import { warmUp } from '../lib/embed'
import { formatPrice, maxBuyPrice } from '../lib/format'
import { takeHandedOffPhoto } from '../lib/handoff'
import { compressImage, imagesFromDataTransfer } from '../lib/image'
import { goBack } from '../lib/router'
import { usePhotoUrls } from '../lib/usePhotoUrls'

const parsePrice = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace('€', '').replace(',', '.'))
  return s.trim() === '' || Number.isNaN(n) ? null : n
}
const priceToString = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

export function ItemForm({ id, onSaved }: { id?: string; onSaved: (id: string) => void }) {
  const [existing, setExisting] = useState<Item | null>(null)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [resalePrice, setResalePrice] = useState('')
  const [material, setMaterial] = useState('')
  const [madeIn, setMadeIn] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState<PendingPhoto[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const keptPhotos = existing?.item_photos.filter((p) => !removedIds.includes(p.id)) ?? []
  const urls = usePhotoUrls(keptPhotos.map((p) => p.path))

  useEffect(() => {
    warmUp().catch(() => {})
    listBrands().then(setBrands).catch(() => {})
    const handed = takeHandedOffPhoto()
    if (handed) void addPhotos([handed])
    if (!id) return
    getItem(id).then((item) => {
      if (!item) return
      setExisting(item)
      setBrand(item.brand)
      setModel(item.model)
      setNewPrice(priceToString(item.new_price))
      setResalePrice(priceToString(item.resale_price))
      setMaterial(item.material ?? '')
      setMadeIn(item.made_in ?? '')
      setNotes(item.notes ?? '')
    })
  }, [id])

  async function addPhotos(files: Blob[]) {
    let compressed: Blob[]
    try {
      compressed = await Promise.all(files.map(compressImage))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return
    }
    setPending((old) => [
      ...old,
      ...compressed.map((blob) => ({ key: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) })),
    ])
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const imgs = imagesFromDataTransfer(e.clipboardData)
      if (imgs.length) {
        e.preventDefault()
        void addPhotos(imgs)
      }
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      const imgs = imagesFromDataTransfer(e.dataTransfer)
      if (imgs.length) {
        e.preventDefault()
        void addPhotos(imgs)
      }
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const resale = parsePrice(resalePrice)
  const newP = parsePrice(newPrice)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (resale == null || resale <= 0) {
      setError('Indiquez le prix de revente en très bon état.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const savedId = await saveItem(
        {
          brand: brand.trim(),
          model: model.trim(),
          new_price: parsePrice(newPrice),
          resale_price: resale,
          material: material.trim() || null,
          made_in: madeIn.trim() || null,
          notes: notes.trim() || null,
        },
        {
          id,
          newPhotos: pending,
          removedPhotoIds: removedIds,
          startPosition: Math.max(-1, ...(existing?.item_photos.map((p) => p.position) ?? [])) + 1,
        },
      )
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      onSaved(savedId)
      // Retour à l'accueil, en remplaçant le formulaire dans l'historique.
      window.location.replace('#/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <button className="btn ghost" onClick={goBack} type="button">
          ← Annuler
        </button>
        <h1 className="page-title">{id ? 'Modifier la fiche' : 'Nouvelle fiche'}</h1>
      </header>

      <form className="item-form" onSubmit={submit}>
        <section className="photos-edit">
          {keptPhotos.map((p) => (
            <div className="photo-tile" key={p.id}>
              {urls[p.path] && <img src={urls[p.path]} alt="" />}
              <button type="button" onClick={() => setRemovedIds((r) => [...r, p.id])} aria-label="Retirer">
                ✕
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div className="photo-tile" key={p.key}>
              <img src={p.previewUrl} alt="" />
              <button
                type="button"
                onClick={() => setPending((old) => old.filter((x) => x.key !== p.key))}
                aria-label="Retirer"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="photo-add">
            <span>📷</span>
            <span>Ajouter des photos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addPhotos(Array.from(e.target.files))
                e.target.value = ''
              }}
            />
          </label>
        </section>
        <p className="hint muted">Plusieurs photos sous différents angles améliorent la recherche. Collage (Ctrl+V) accepté.</p>

        <div className="form-grid">
          <label>
            Marque *
            <input value={brand} onChange={(e) => setBrand(e.target.value)} list="brands" required />
            <datalist id="brands">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label>
            Modèle *
            <input value={model} onChange={(e) => setModel(e.target.value)} required />
          </label>
          <label>
            Revente très bon état (€) *
            <input value={resalePrice} onChange={(e) => setResalePrice(e.target.value)} inputMode="decimal" required />
          </label>
          <label>
            Prix neuf (€)
            <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} inputMode="decimal" />
          </label>
        </div>

        <div className="max-buy-pair">
          <div className="max-buy big">
            <span>Achat max TBE (revente ÷ 2,2)</span>
            <strong>{resale ? formatPrice(maxBuyPrice(resale)) : '–'}</strong>
          </div>
          <div className="max-buy big">
            <span>Achat max neuf (prix neuf ÷ 2,2)</span>
            <strong>{newP ? formatPrice(maxBuyPrice(newP)) : '–'}</strong>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Matière
            <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="ex. 100 % laine" />
          </label>
          <label>
            Lieu de fabrication
            <input value={madeIn} onChange={(e) => setMadeIn(e.target.value)} placeholder="ex. Italie" />
          </label>
        </div>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        </label>

        {error && <p className="error">{error}</p>}
        <button className="btn primary big-btn" disabled={saving}>
          {saving ? (pending.length ? 'Envoi et analyse des photos…' : 'Enregistrement…') : 'Enregistrer'}
        </button>
      </form>
    </main>
  )
}
