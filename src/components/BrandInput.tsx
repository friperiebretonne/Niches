import { useState } from 'react'

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Champ marque avec suggestions des marques déjà saisies (fonctionne aussi sur téléphone). */
export function BrandInput({
  value,
  onChange,
  brands,
}: {
  value: string
  onChange: (v: string) => void
  brands: string[]
}) {
  const [open, setOpen] = useState(false)
  const q = normalize(value)
  const suggestions = brands
    .filter((b) => {
      const n = normalize(b)
      return n !== q && (q === '' || n.includes(q))
    })
    .sort((a, b) => Number(normalize(b).startsWith(q)) - Number(normalize(a).startsWith(q)))
    .slice(0, 8)

  return (
    <div className="combo">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        // Laisse le temps au clic sur une suggestion d'être pris en compte.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        autoCapitalize="words"
        required
      />
      {open && suggestions.length > 0 && (
        <ul className="combo-list" role="listbox">
          {suggestions.map((b) => (
            <li key={b}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(b)
                  setOpen(false)
                }}
              >
                {b}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
