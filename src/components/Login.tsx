import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Identifiants incorrects.')
    setBusy(false)
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <h1>Niches</h1>
        <p className="muted">Base de référence des modèles</p>
        <label>
          E-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
