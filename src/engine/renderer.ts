import { EFFECTS } from './effects'
import { computeStrips, drawStrips } from './ripple'
import { buildSource, sourceKey } from './source'
import type { AppState, FrameContext, Strip } from './types'

export type ImageSource = (CanvasImageSource & { width: number; height: number }) | null

export const REFERENCE_SIZE = 1280

/** Renders one frame of the pipeline: source → slice & shift → effect stack. Owns its caches. */
export class Renderer {
  private source = document.createElement('canvas')
  private srcKey = ''
  private scratches = new Map<string, HTMLCanvasElement>()
  image: ImageSource = null
  imageId = 0

  setImage(img: ImageSource) {
    this.image = img
    this.imageId++
  }

  private scratch = (name: string, w?: number, h?: number) => {
    let c = this.scratches.get(name)
    if (!c) {
      c = document.createElement('canvas')
      this.scratches.set(name, c)
    }
    if (w !== undefined && c.width !== w) c.width = w
    if (h !== undefined && c.height !== h) c.height = h
    return c
  }

  heavyEnabled(state: AppState) {
    return EFFECTS.some((e) => e.heavy && state.effects[e.id]?.enabled)
  }

  render(canvas: HTMLCanvasElement, state: AppState, t: number, pointer = { x: 0.5, y: 0.5 }): Strip[] {
    const w = canvas.width
    const h = canvas.height
    const ctx = canvas.getContext('2d')!
    const key = sourceKey(w, h, state.source, this.imageId)
    if (key !== this.srcKey) {
      buildSource(this.source, w, h, state.source, this.image)
      this.srcKey = key
    }
    const strips = computeStrips(state.core, w, h, t)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, w, h)
    drawStrips(ctx, this.source, strips, h)

    const fc: FrameContext = {
      canvas,
      ctx,
      w,
      h,
      unit: Math.max(w, h) / REFERENCE_SIZE,
      t,
      core: state.core,
      strips,
      pointer,
      source: this.source,
      scratch: this.scratch,
    }
    for (const e of EFFECTS) {
      const es = state.effects[e.id]
      if (!es?.enabled) continue
      ctx.save()
      e.apply(fc, es.params)
      ctx.restore()
    }
    return strips
  }

  /** Source canvas at the given size (used by SVG export). */
  sourceAt(w: number, h: number, state: AppState) {
    const c = document.createElement('canvas')
    buildSource(c, w, h, state.source, this.image)
    return c
  }
}
