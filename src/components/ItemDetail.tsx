import { useEffect, useState } from 'react'
import type { Item } from '../types'
import { deleteItem, getItem } from '../lib/api'
import { formatPrice } from '../lib/format'
import { goBack, hrefFor, navigate } from '../lib/router'
import { usePhotoUrls } from '../lib/usePhotoUrls'

export function ItemDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [item, setItem] = useState<Item | null | undefined>(undefined)
  const [current, setCurrent] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const urls = usePhotoUrls(item?.item_photos.map((p) => p.path) ?? [])

  useEffect(() => {
    getItem(id).then(setItem).catch(() => setItem(null))
  }, [id])

  if (item === undefined) return <main className="page"><p className="status">Chargement…</p></main>
  if (item === null)
    return (
      <main className="page">
        <p className="error">Fiche introuvable.</p>
        <a className="btn" href="#/">Retour</a>
      </main>
    )

  const photos = item.item_photos
  const remove = async () => {
    await deleteItem(item)
    onChanged()
    navigate({ name: 'search' })
  }

  return (
    <main className="page detail">
      <header className="topbar">
        <button className="btn ghost" onClick={goBack}>← Retour</button>
        <a className="btn" href={hrefFor({ name: 'edit', id: item.id })}>Modifier</a>
      </header>

      {photos.length > 0 && (
        <section className="gallery">
          <div className="gallery-main">
            {urls[photos[current]?.path] && <img src={urls[photos[current].path]} alt="" />}
          </div>
          {photos.length > 1 && (
            <div className="gallery-thumbs">
              {photos.map((p, i) => (
                <button key={p.id} className={i === current ? 'active' : ''} onClick={() => setCurrent(i)}>
                  {urls[p.path] && <img src={urls[p.path]} alt="" />}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="detail-info">
        <div className="brand">{item.brand}</div>
        <h1 className="model">{item.model}</h1>

        <div className="price-panel">
          <div className="max-buy big">
            <span>Prix d'achat max</span>
            <strong>{formatPrice(item.max_buy_price)}</strong>
          </div>
          <div className="price-row">
            <span>Revente très bon état</span>
            <strong>{formatPrice(item.resale_price)}</strong>
          </div>
          <div className="price-row">
            <span>Prix neuf</span>
            <strong>{formatPrice(item.new_price)}</strong>
          </div>
        </div>

        <dl className="facts">
          {item.material && (
            <>
              <dt>Matière</dt>
              <dd>{item.material}</dd>
            </>
          )}
          {item.made_in && (
            <>
              <dt>Fabrication</dt>
              <dd>{item.made_in}</dd>
            </>
          )}
        </dl>
        {item.notes && <p className="notes">{item.notes}</p>}

        <div className="danger-zone">
          {confirming ? (
            <>
              <span>Supprimer définitivement cette fiche ?</span>
              <button className="btn danger" onClick={remove}>Oui, supprimer</button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Annuler</button>
            </>
          ) : (
            <button className="btn ghost danger-text" onClick={() => setConfirming(true)}>Supprimer la fiche</button>
          )}
        </div>
      </section>
    </main>
  )
}
