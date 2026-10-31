import { EFFECTS } from './effects'
import { toHex } from './palette'
import { computeStrips } from './ripple'
import { REFERENCE_SIZE, Renderer } from './renderer'
import { aspectRatio } from './state'
import type { AppState, Aspect } from './types'

/** Safari caps canvas area at 16,777,216 px. */
const MAX_AREA = 16_777_216

export function exportSize(aspect: Aspect, scale: number) {
  const r = aspectRatio(aspect)
  let w = r >= 1 ? REFERENCE_SIZE * scale : Math.round(REFERENCE_SIZE * scale * r)
  let h = r >= 1 ? Math.round((REFERENCE_SIZE * scale) / r) : REFERENCE_SIZE * scale
  let clamped = false
  if (w * h > MAX_AREA) {
    const k = Math.sqrt(MAX_AREA / (w * h))
    w = Math.floor(w * k)
    h = Math.floor(h * k)
    clamped = true
  }
  return { w, h, clamped }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

export async function exportPNG(renderer: Renderer, state: AppState, scale: number, t: number, pointer: { x: number; y: number }) {
  const { w, h } = exportSize(state.aspect, scale)
  const r = new Renderer()
  r.image = renderer.image
  r.imageId = renderer.imageId
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  r.render(c, state, t, pointer)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Не удалось создать PNG')
  download(blob, `ripplyn-ripple-${w}x${h}-${stamp()}.png`)
}

export function videoMime() {
  if (typeof MediaRecorder === 'undefined') return null
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

/** Real-time recording of a dedicated canvas via MediaRecorder. */
export async function exportVideo(
  renderer: Renderer,
  state: AppState,
  opts: { seconds: number; height: number; fps: number; t0: number; pointer: { x: number; y: number }; onProgress?: (p: number) => void; signal?: AbortSignal },
) {
  const mime = videoMime()
  if (!mime) throw new Error('MediaRecorder недоступен в этом браузере')
  const r = aspectRatio(state.aspect)
  // even dimensions keep encoders happy
  let h = opts.height
  let w = Math.round(h * r)
  if (r < 1) {
    w = opts.height
    h = Math.round(w / r)
  }
  w -= w % 2
  h -= h % 2
  const rr = new Renderer()
  rr.image = renderer.image
  rr.imageId = renderer.imageId
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  // some browsers only capture canvases that are in the document
  Object.assign(c.style, { position: 'fixed', left: '-10000px', top: '0', width: '1px', height: '1px', pointerEvents: 'none' })
  document.body.appendChild(c)
  rr.render(c, state, opts.t0, opts.pointer)
  const stream = c.captureStream(opts.fps)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(w * h * opts.fps * 0.15) })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<void>((res) => (rec.onstop = () => res()))
  rec.start(250)
  const start = performance.now()
  await new Promise<void>((resolve) => {
    const step = () => {
      const el = (performance.now() - start) / 1000
      if (el >= opts.seconds || opts.signal?.aborted) return resolve()
      rr.render(c, state, opts.t0 + el, opts.pointer)
      opts.onProgress?.(el / opts.seconds)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  rec.stop()
  await done
  stream.getTracks().forEach((t) => t.stop())
  c.remove()
  if (opts.signal?.aborted) return
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
  download(new Blob(chunks, { type: mime.split(';')[0] }), `ripplyn-ripple-${w}x${h}-${opts.seconds}s-${stamp()}.${ext}`)
}

/** Effects that block SVG export with the current settings. */
export function svgBlockers(state: AppState): string[] {
  return EFFECTS.filter((e) => {
    const es = state.effects[e.id]
    if (!es?.enabled) return false
    if (!e.svg) return true
    return e.svg({ w: 100, h: 100, strips: [], t: 0, pointer: { x: 0.5, y: 0.5 } }, es.params) === null
  }).map((e) => e.name)
}

/** Strips as <rect>s, each filled with a gradient sampled from the source column under the strip. */
export function buildSVG(renderer: Renderer, state: AppState, t: number, pointer: { x: number; y: number }) {
  const { w, h } = exportSize(state.aspect, 1)
  const src = renderer.sourceAt(w, h, state)
  const sctx = src.getContext('2d', { willReadFrequently: true })!
  const strips = computeStrips(state.core, w, h, t)
  const STOPS = 32
  const defs: string[] = []
  const body: string[] = []
  strips.forEach((s, i) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(s.x + s.w / 2)))
    const col = sctx.getImageData(x, 0, 1, h).data
    const at = (y: number) => {
      const k = Math.min(h - 1, Math.max(0, Math.round(y))) * 4
      return toHex([col[k], col[k + 1], col[k + 2]])
    }
    const stops = Array.from({ length: STOPS + 1 }, (_, j) => `<stop offset="${(j / STOPS).toFixed(4)}" stop-color="${at((j / STOPS) * (h - 1))}"/>`).join('')
    defs.push(`<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`)
    const off = s.offset
    body.push(`<rect x="${s.x}" y="${off.toFixed(2)}" width="${s.w + 0.5}" height="${h}" fill="url(#g${i})"/>`)
    if (off > 0) body.push(`<rect x="${s.x}" y="0" width="${s.w + 0.5}" height="${(off + 1).toFixed(2)}" fill="${at(0)}"/>`)
    else if (off < 0) body.push(`<rect x="${s.x}" y="${(h + off - 1).toFixed(2)}" width="${s.w + 0.5}" height="${(-off + 1).toFixed(2)}" fill="${at(h - 1)}"/>`)
  })
  const overlays = EFFECTS.filter((e) => state.effects[e.id]?.enabled && e.svg)
    .map((e) => e.svg!({ w, h, strips, t, pointer }, state.effects[e.id].params) ?? '')
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs><g shape-rendering="crispEdges">${body.join('')}</g>${overlays}</svg>`
}

export function exportSVG(renderer: Renderer, state: AppState, t: number, pointer: { x: number; y: number }) {
  const svg = buildSVG(renderer, state, t, pointer)
  download(new Blob([svg], { type: 'image/svg+xml' }), `ripplyn-ripple-${stamp()}.svg`)
}
