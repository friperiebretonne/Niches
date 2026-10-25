import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers'
import type { PreTrainedModel, Processor } from '@huggingface/transformers'

// Modèle CLIP : transforme une photo en empreinte de 512 nombres.
// Téléchargé une seule fois par appareil, puis gardé dans le cache du navigateur.
const MODEL_ID = 'Xenova/clip-vit-base-patch32'

env.allowLocalModels = false

let loading: Promise<[Processor, PreTrainedModel]> | null = null

function load() {
  loading ??= Promise.all([
    AutoProcessor.from_pretrained(MODEL_ID),
    CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; file?: string; progress?: number }) => {
        if (p.status === 'progress' && p.file?.endsWith('.onnx')) {
          self.postMessage({ type: 'progress', progress: p.progress ?? 0 })
        }
      },
    }),
  ])
  return loading
}

self.onmessage = async (e: MessageEvent<{ id: number; blob?: Blob; warmup?: boolean }>) => {
  const { id, blob, warmup } = e.data
  try {
    const [processor, model] = await load()
    if (warmup || !blob) {
      self.postMessage({ type: 'ready', id })
      return
    }
    const image = await RawImage.fromBlob(blob)
    const { image_embeds } = await model(await processor(image))
    const v = Array.from(image_embeds.data as Float32Array)
    const norm = Math.hypot(...v)
    self.postMessage({ type: 'result', id, embedding: v.map((x) => x / norm) })
  } catch (err) {
    loading = null
    self.postMessage({ type: 'error', id, message: err instanceof Error ? err.message : String(err) })
  }
}
