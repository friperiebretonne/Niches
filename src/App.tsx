import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { useRoute } from './lib/router'
import { warmUp } from './lib/embed'
import { Login } from './components/Login'
import { SearchView } from './components/SearchView'
import { ItemDetail } from './components/ItemDetail'
import { ItemForm } from './components/ItemForm'
import { Settings } from './components/Settings'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState<{ text: string; id: string } | null>(null)
  const route = useRoute()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Prépare le moteur photo en arrière-plan dès la connexion (téléchargé une seule fois
  // par appareil, puis lu depuis le cache) pour que la recherche photo soit immédiate.
  useEffect(() => {
    if (session) warmUp().catch(() => {})
  }, [session])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  if (!isConfigured)
    return (
      <main className="page">
        <p className="error">
          Configuration manquante : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies.
        </p>
      </main>
    )
  if (session === undefined) return null
  if (!session) return <Login />

  const refresh = () => setRefreshKey((k) => k + 1)
  const saved = (id: string) => {
    refresh()
    setNotice({ text: 'Fiche enregistrée', id })
  }

  return (
    <>
      <SearchView active={route.name === 'search'} refreshKey={refreshKey} />
      {route.name === 'detail' && <ItemDetail key={route.id} id={route.id} onChanged={refresh} />}
      {route.name === 'new' && <ItemForm key="new" onSaved={saved} />}
      {route.name === 'edit' && <ItemForm key={route.id} id={route.id} onSaved={saved} />}
      {route.name === 'settings' && <Settings />}
      {notice && (
        <a className="toast" href={`#/fiche/${notice.id}`} onClick={() => setNotice(null)}>
          ✓ {notice.text} · <u>Voir</u>
        </a>
      )}
    </>
  )
}
