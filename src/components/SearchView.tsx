import { useCallback, useEffect, useRef, useState } from 'react'
import type { Item, SearchHit } from '../types'
import { countItems, listRecent, searchImage, searchText } from '../lib/api'
import { isModelReady, onModelProgress } from '../lib/embed'
import { imagesFromDataTransfer } from '../lib/image'
import { handOffPhoto } from '../lib/handoff'
import { hrefFor, navigate } from '../lib/router'
import { usePhotoUrls } from '../lib/usePhotoUrls'
import { ItemCard } from './ItemCard'

type Status = 'idle' | 'loading' | 'done' | 'error'

export function SearchView({ active, refreshKey }: { active: boolean; refreshKey: number }) {
  const [query, setQuery] = useState('')
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [recent, setRecent] = useState<Item[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [modelProgress, setModelProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const requestId = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRecent().then(setRecent).catch(() => {})
    countItems().then(setTotal).catch(() => {})
  }, [refreshKey])

  useEffect(
    () =>
      onModelProgress((p) => {
        setModelProgress(p >= 100 ? null : p)
      }),
    [],
  )

  const runSearch = useCallback(async (run: () => Promise<SearchHit[]>) => {
    const id = ++requestId.current
    setStatus('loading')
    setError(null)
    try {
      const result = await run()
      if (id !== requestId.current) return
      setHits(result)
      setStatus('done')
    } catch (e) {
      if (id !== requestId.current) return
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  // Recherche texte, déclenchée 250 ms après la dernière frappe.
  useEffect(() => {
    if (photo) return
    const q = query.trim()
    if (q.length < 2) {
      requestId.current++
      setStatus('idle')
      setHits([])
      return
    }
    const t = setTimeout(() => runSearch(() => searchText(q)), 250)
    return () => clearTimeout(t)
  }, [query, photo, runSearch, refreshKey])

  const searchByPhoto = useCallback(
    (blob: Blob) => {
      setQuery('')
      setPhoto((old) => {
        if (old) URL.revokeObjectURL(old.url)
        return { blob, url: URL.createObjectURL(blob) }
      })
      runSearch(() => searchImage(blob))
    },
    [runSearch],
  )

  // Après l'ajout ou la modification d'une fiche, relance la recherche photo en cours.
  useEffect(() => {
    if (photo && refreshKey > 0) runSearch(() => searchImage(photo.blob))
  }, [refreshKey])

  const clearPhoto = () => {
    requestId.current++
    if (photo) URL.revokeObjectURL(photo.url)
    setPhoto(null)
    setHits([])
    setStatus('idle')
  }

  // Coller une image (Ctrl+V) ou la glisser n'importe où sur la page.
  useEffect(() => {
    if (!active) return
    const onPaste = (e: ClipboardEvent) => {
      const [img] = imagesFromDataTransfer(e.clipboardData)
      if (img) {
        e.preventDefault()
        searchByPhoto(img)
      }
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        setDragging(true)
      }
    }
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      setDragging(false)
      const [img] = imagesFromDataTransfer(e.dataTransfer)
      if (img) {
        e.preventDefault()
        searchByPhoto(img)
      }
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [active, searchByPhoto])

  const searching = photo != null || query.trim().length >= 2
  const shown: SearchHit[] = searching ? hits : recent.map((item) => ({ item }))
  const urls = usePhotoUrls(shown.flatMap((h) => (h.item.item_photos[0] ? [h.item.item_photos[0].path] : [])))

  const createFromSearch = () => {
    if (photo) handOffPhoto(photo.blob)
    navigate({ name: 'new' })
  }

  return (
    <main className="search-view" hidden={!active}>
      <header className="topbar">
        <a className="logo" href="#/">
          Niches
        </a>
        <div className="topbar-actions">
          <a className="btn primary" href={hrefFor({ name: 'new' })}>
            + Fiche
          </a>
          <a className="btn icon" href={hrefFor({ name: 'settings' })} aria-label="Réglages">
            ⚙
          </a>
        </div>
      </header>

      <div className="search-bar">
        {photo ? (
          <div className="photo-query">
            <img src={photo.url} alt="Photo recherchée" />
            <span>Recherche par photo</span>
            <button className="btn ghost" onClick={clearPhoto}>
              ✕ Effacer
            </button>
          </div>
        ) : (
          <input
            type="search"
            placeholder="Marque, modèle, matière…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            enterKeyHint="search"
          />
        )}
        <button className="btn photo-btn" onClick={() => fileInput.current?.click()}>
          📷 Photo
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) searchByPhoto(file)
            e.target.value = ''
          }}
        />
      </div>
      <p className="hint muted desktop-only">Astuce : collez une photo d'annonce (Ctrl+V) ou glissez-la sur la page.</p>

      {status === 'loading' && (
        <p className="status">
          {photo && !isModelReady()
            ? `Chargement du moteur photo${modelProgress != null ? ` (${Math.round(modelProgress)} %)` : ''}… (seulement la première fois sur cet appareil)`
            : 'Recherche…'}
        </p>
      )}
      {status === 'error' && <p className="error">Erreur : {error}</p>}

      {searching && status === 'done' && hits.length === 0 && (
        <div className="empty card">
          <p>
            <strong>Rien de trouvé</strong>
            {photo ? ' : aucun modèle ressemblant dans la base.' : ` pour « ${query.trim()} ».`}
          </p>
          <button className="btn primary" onClick={createFromSearch}>
            {photo ? 'Créer une fiche avec cette photo' : 'Créer une fiche'}
          </button>
        </div>
      )}

      {!searching && (
        <h2 className="section-title">
          Dernières fiches{total != null && <span className="muted"> · {total} au total</span>}
        </h2>
      )}
      {searching && status === 'done' && hits.length > 0 && (
        <h2 className="section-title">
          {hits.length} résultat{hits.length > 1 ? 's' : ''}
        </h2>
      )}

      {(!searching || status === 'done') && (
        <div className="grid">
          {shown.map((hit) => (
            <ItemCard key={hit.item.id} hit={hit} photoUrl={urls[hit.item.item_photos[0]?.path]} />
          ))}
        </div>
      )}

      {!searching && total === 0 && (
        <div className="empty card">
          <p>La base est vide. Ajoutez votre première fiche !</p>
          <a className="btn primary" href={hrefFor({ name: 'new' })}>
            + Nouvelle fiche
          </a>
        </div>
      )}

      {dragging && <div className="drop-overlay">Déposez la photo pour lancer la recherche</div>}
    </main>
  )
}
