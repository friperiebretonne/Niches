import type { SearchHit } from '../types'
import { formatPrice, maxBuyPrice, similarityLabel } from '../lib/format'
import { hrefFor } from '../lib/router'

export function ItemCard({ hit, photoUrl }: { hit: SearchHit; photoUrl?: string }) {
  const { item, similarity } = hit
  const sim = similarity != null ? similarityLabel(similarity) : null
  return (
    <a className="card item-card" href={hrefFor({ name: 'detail', id: item.id })}>
      <div className="thumb">
        {photoUrl ? <img src={photoUrl} alt="" loading="lazy" /> : <span className="no-photo">Pas de photo</span>}
        {sim && (
          <span className={`badge sim-${sim.level}`}>
            {sim.label} · {Math.round(similarity! * 100)} %
          </span>
        )}
      </div>
      <div className="item-body">
        <div className="brand">{item.brand}</div>
        <div className="model">{item.model}</div>
        <div className="max-buy-pair">
          <div className="max-buy">
            <span>Achat max neuf</span>
            <strong>{item.new_price != null ? formatPrice(maxBuyPrice(item.new_price)) : '–'}</strong>
          </div>
          <div className="max-buy">
            <span>Achat max TBE</span>
            <strong>{formatPrice(item.max_buy_price)}</strong>
          </div>
        </div>
        <div className="prices">
          <span>Revente TBE {formatPrice(item.resale_price)}</span>
          {item.new_price != null && <span>Neuf {formatPrice(item.new_price)}</span>}
        </div>
      </div>
    </a>
  )
}
