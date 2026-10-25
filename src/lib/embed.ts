type Pending = { resolve: (v: number[]) => void; reject: (e: Error) => void }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()
const progressListeners = new Set<(p: number) => void>()
let ready = false

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => {
    const msg = e.data
    if (msg.type === 'progress') {
      progressListeners.forEach((l) => l(msg.progress))
      return
    }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.type === 'error') p.reject(new Error(msg.message))
    else {
      ready = true
      progressListeners.forEach((l) => l(100))
      p.resolve(msg.embedding ?? [])
    }
  }
  return worker
}

function send(payload: { blob?: Blob; warmup?: boolean }) {
  const id = nextId++
  return new Promise<number[]>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, ...payload })
  })
}

/** Calcule l'empreinte visuelle (512 nombres) d'une photo, dans le navigateur. */
export const embedImage = (blob: Blob) => send({ blob })

/** Charge le modèle en arrière-plan pour que la première recherche photo soit rapide. */
export const warmUp = () => send({ warmup: true }).then(() => undefined)

export const isModelReady = () => ready

export function onModelProgress(listener: (progress: number) => void) {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}
