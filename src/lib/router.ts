import { useEffect, useState } from 'react'

export type Route =
  | { name: 'search' }
  | { name: 'detail'; id: string }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'settings' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'fiche' && parts[1]) return { name: 'detail', id: parts[1] }
  if (parts[0] === 'modifier' && parts[1]) return { name: 'edit', id: parts[1] }
  if (parts[0] === 'nouvelle') return { name: 'new' }
  if (parts[0] === 'reglages') return { name: 'settings' }
  return { name: 'search' }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'detail':
      return `#/fiche/${route.id}`
    case 'edit':
      return `#/modifier/${route.id}`
    case 'new':
      return '#/nouvelle'
    case 'settings':
      return '#/reglages'
    default:
      return '#/'
  }
}

export const navigate = (route: Route) => {
  window.location.hash = hrefFor(route)
}

/** Retour en arrière si possible (bouton retour du téléphone), sinon accueil. */
export const goBack = () => {
  if (window.history.length > 1) window.history.back()
  else navigate({ name: 'search' })
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
