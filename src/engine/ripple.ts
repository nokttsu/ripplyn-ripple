import type { CoreParams, Strip } from './types'

export const stripCount = (exp: number) => 2 ** Math.max(1, Math.min(9, Math.round(exp)))

/**
 * offset = sin(dist·π·freq − t·speed) · amp · (1 − dist·0.5)
 * dist — horizontal distance of the strip centre from the impact point, normalized to 0…1.
 */
export function computeStrips(core: CoreParams, w: number, h: number, t: number): Strip[] {
  const n = stripCount(core.stripsExp)
  const ix = core.impactX
  const span = Math.max(ix, 1 - ix, 1e-6)
  const ampPx = core.amp * h
  const strips: Strip[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const x0 = Math.round((i * w) / n)
    const x1 = Math.round(((i + 1) * w) / n)
    const cx = (i + 0.5) / n
    const dist = Math.min(1, Math.abs(cx - ix) / span)
    const phase = dist * Math.PI * core.freq - t * core.speed
    const k = ampPx * (1 - dist * 0.5)
    strips[i] = {
      x: x0,
      w: x1 - x0,
      cx,
      dist,
      offset: Math.sin(phase) * k,
      velocity: -Math.cos(phase) * core.speed * k,
    }
  }
  return strips
}

/** Draws the sliced & shifted source; the gaps are filled with the strip's stretched edge pixel row. */
export function drawStrips(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, strips: Strip[], h: number) {
  ctx.imageSmoothingEnabled = true
  for (const s of strips) {
    if (s.w <= 0) continue
    const off = s.offset
    ctx.drawImage(src, s.x, 0, s.w, h, s.x, off, s.w, h)
    if (off > 0) {
      ctx.drawImage(src, s.x, 0, s.w, 1, s.x, 0, s.w, Math.ceil(off) + 1)
    } else if (off < 0) {
      ctx.drawImage(src, s.x, h - 1, s.w, 1, s.x, Math.floor(h + off) - 1, s.w, Math.ceil(-off) + 2)
    }
  }
}
