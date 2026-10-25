import { useEffect, useState } from 'react'
import { photoUrls } from './api'

export function usePhotoUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = paths.join('|')
  useEffect(() => {
    if (!key) return
    let cancelled = false
    photoUrls(key.split('|'))
      .then((u) => !cancelled && setUrls(u))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [key])
  return urls
}
