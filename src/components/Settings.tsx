import { useState } from 'react'
import { exportJson } from '../lib/api'
import { supabase } from '../lib/supabase'
import { goBack } from '../lib/router'

export function Settings() {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const blob = await exportJson()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `niches-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <button className="btn ghost" onClick={goBack}>
          ← Retour
        </button>
        <h1 className="page-title">Réglages</h1>
      </header>
      <section className="card settings">
        <h2>Sauvegarde</h2>
        <p className="muted">Télécharge toutes les fiches (sans les photos) dans un fichier JSON.</p>
        <button className="btn" onClick={download} disabled={busy}>
          {busy ? 'Préparation…' : 'Exporter les fiches'}
        </button>
      </section>
      <section className="card settings">
        <h2>Compte</h2>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </section>
    </main>
  )
}
