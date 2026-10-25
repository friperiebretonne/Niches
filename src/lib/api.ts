import { supabase } from './supabase'
import { embedImage } from './embed'
import { compressImage } from './image'
import type { Item, ItemDraft, PendingPhoto, SearchHit } from '../types'

const BUCKET = 'photos'
const ITEM_COLUMNS =
  'id,brand,model,new_price,resale_price,max_buy_price,material,made_in,gender,notes,created_at,updated_at,item_photos(id,item_id,path,position)'

function normalize(row: Item): Item {
  return {
    ...row,
    new_price: row.new_price == null ? null : Number(row.new_price),
    resale_price: Number(row.resale_price),
    max_buy_price: Number(row.max_buy_price),
    item_photos: [...(row.item_photos ?? [])].sort((a, b) => a.position - b.position),
  }
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

async function userId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Session expirée, reconnectez-vous.')
  return id
}

async function fetchItemsByIds(ids: string[]): Promise<Map<string, Item>> {
  if (ids.length === 0) return new Map()
  const rows = check(await supabase.from('items').select(ITEM_COLUMNS).in('id', ids)) as unknown as Item[]
  return new Map(rows.map((r) => [r.id, normalize(r)]))
}

export async function listRecent(limit = 24): Promise<Item[]> {
  const rows = check(
    await supabase.from('items').select(ITEM_COLUMNS).order('created_at', { ascending: false }).limit(limit),
  ) as unknown as Item[]
  return rows.map(normalize)
}

export async function countItems(): Promise<number> {
  const { count, error } = await supabase.from('items').select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function searchText(q: string): Promise<SearchHit[]> {
  const ranked = check(await supabase.rpc('search_items_text', { q, max_results: 40 })) as {
    item_id: string
    score: number
  }[]
  const items = await fetchItemsByIds(ranked.map((r) => r.item_id))
  return ranked.flatMap((r) => (items.has(r.item_id) ? [{ item: items.get(r.item_id)! }] : []))
}

export async function searchImage(blob: Blob): Promise<SearchHit[]> {
  // Ré-encodée ici pour que le moteur photo reçoive toujours une image qu'il sait lire.
  const embedding = await embedImage(await compressImage(blob))
  const ranked = check(
    await supabase.rpc('search_items_image', { query: JSON.stringify(embedding), max_results: 12 }),
  ) as { item_id: string; similarity: number }[]
  const items = await fetchItemsByIds(ranked.map((r) => r.item_id))
  return ranked.flatMap((r) =>
    items.has(r.item_id) ? [{ item: items.get(r.item_id)!, similarity: r.similarity }] : [],
  )
}

export async function getItem(id: string): Promise<Item | null> {
  return (await fetchItemsByIds([id])).get(id) ?? null
}

let brandCache: string[] | null = null

export async function listBrands(): Promise<string[]> {
  if (brandCache) return brandCache
  const rows = check(await supabase.rpc('list_brands')) as { brand: string }[]
  brandCache = rows.map((r) => r.brand)
  return brandCache
}

/** Crée ou met à jour une fiche, envoie les nouvelles photos et calcule leurs empreintes. */
export async function saveItem(
  draft: ItemDraft,
  options: { id?: string; newPhotos: PendingPhoto[]; removedPhotoIds: string[]; startPosition: number },
): Promise<string> {
  brandCache = null
  const uid = await userId()
  let id = options.id
  if (id) {
    check(await supabase.from('items').update(draft).eq('id', id))
  } else {
    const row = check(await supabase.from('items').insert(draft).select('id').single()) as { id: string }
    id = row.id
  }

  if (options.removedPhotoIds.length) {
    const removed = check(
      await supabase.from('item_photos').delete().in('id', options.removedPhotoIds).select('path'),
    ) as { path: string }[]
    if (removed.length) await supabase.storage.from(BUCKET).remove(removed.map((r) => r.path))
  }

  let position = options.startPosition
  for (const photo of options.newPhotos) {
    const ext = photo.blob.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${uid}/${id}/${crypto.randomUUID()}.${ext}`
    const [embedding] = await Promise.all([
      embedImage(photo.blob),
      supabase.storage
        .from(BUCKET)
        .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: '31536000' })
        .then(({ error }) => {
          if (error) throw new Error(error.message)
        }),
    ])
    check(
      await supabase
        .from('item_photos')
        .insert({ item_id: id, path, position: position++, embedding: JSON.stringify(embedding) }),
    )
  }
  return id
}

export async function deleteItem(item: Item) {
  brandCache = null
  const paths = item.item_photos.map((p) => p.path)
  check(await supabase.from('items').delete().eq('id', item.id))
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

// Liens d'accès aux photos (bucket privé), mis en cache pour limiter les requêtes.
const URL_TTL = 60 * 60 * 24
const urlCache = new Map<string, { url: string; expires: number }>()

export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const missing = paths.filter((p) => (urlCache.get(p)?.expires ?? 0) < now + 60_000)
  if (missing.length) {
    const signed = check(await supabase.storage.from(BUCKET).createSignedUrls(missing, URL_TTL))
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlCache.set(s.path, { url: s.signedUrl, expires: now + URL_TTL * 1000 })
    }
  }
  return Object.fromEntries(paths.flatMap((p) => (urlCache.has(p) ? [[p, urlCache.get(p)!.url]] : [])))
}

/** Sauvegarde de secours : toutes les fiches (sans les photos) au format JSON. */
export async function exportJson(): Promise<Blob> {
  // Supabase renvoie au plus 1000 lignes par requête : on lit par pages.
  const PAGE = 1000
  const rows: Item[] = []
  for (let from = 0; ; from += PAGE) {
    const page = check(
      await supabase
        .from('items')
        .select(ITEM_COLUMNS)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1),
    ) as unknown as Item[]
    rows.push(...page)
    if (page.length < PAGE) break
  }
  const data = { exported_at: new Date().toISOString(), items: rows.map(normalize) }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}
