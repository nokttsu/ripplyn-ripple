import { css, RGB_OF, rampColors, sampleRamp } from './palette'
import type { SourceState } from './types'

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Vertical gradient + soft radial spots + thin horizon line, all from the brand palette. */
export function drawGenerated(ctx: CanvasRenderingContext2D, w: number, h: number, s: SourceState) {
  const stops = rampColors(s.ramp)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, css(sampleRamp(stops, 0.92)))
  g.addColorStop(0.45, css(sampleRamp(stops, 0.62)))
  g.addColorStop(0.62, css(sampleRamp(stops, 0.38)))
  g.addColorStop(1, css(sampleRamp(stops, 0.04)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  const rnd = mulberry32(s.seed)
  for (let k = 0; k < s.spots; k++) {
    const cx = w * (0.05 + 0.9 * rnd())
    const cy = h * (0.25 + 0.6 * rnd())
    const r = Math.max(w, h) * (0.1 + 0.18 * rnd())
    const c = sampleRamp(stops, 0.2 + 0.75 * rnd())
    const a = 0.45 + 0.4 * rnd()
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    rg.addColorStop(0, css(c, a))
    rg.addColorStop(1, css(c, 0))
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, w, h)
  }

  if (s.horizon) {
    const y = h * 0.58
    const lh = Math.max(1, h * 0.006)
    ctx.fillStyle = css(sampleRamp(stops, 1), 0.85)
    ctx.fillRect(0, y, w, lh)
  }
}

/** Cover-fit an uploaded image. */
export function drawImageCover(ctx: CanvasRenderingContext2D, w: number, h: number, img: CanvasImageSource & { width: number; height: number }) {
  const iw = img.width
  const ih = img.height
  const k = Math.max(w / iw, h / ih)
  const dw = iw * k
  const dh = ih * k
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

/** Fit monospace text into the canvas so the longest line and all lines are visible. */
export function drawAsciiText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  fg: string,
  bg: string | null,
  opts: { padding?: number; alpha?: number; scale?: number } = {},
) {
  const lines = text.replace(/\t/g, '  ').split('\n')
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (!lines.length) return
  const cols = Math.max(1, ...lines.map((l) => l.length))
  const pad = opts.padding ?? 0.06
  const aw = w * (1 - pad * 2)
  const ah = h * (1 - pad * 2)
  // Geist Mono advance ≈ 0.6em, line height 1.15em
  let size = Math.min(aw / (cols * 0.6), ah / (lines.length * 1.15))
  size *= opts.scale ?? 1
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
  }
  ctx.save()
  ctx.globalAlpha = opts.alpha ?? 1
  ctx.fillStyle = fg
  ctx.font = `500 ${size}px "Geist Mono", ui-monospace, Menlo, monospace`
  ctx.textBaseline = 'top'
  const blockW = cols * size * 0.6
  const blockH = lines.length * size * 1.15
  const x0 = (w - blockW) / 2
  const y0 = (h - blockH) / 2
  lines.forEach((line, i) => ctx.fillText(line, x0, y0 + i * size * 1.15))
  ctx.restore()
}

export function buildSource(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  s: SourceState,
  image: (CanvasImageSource & { width: number; height: number }) | null,
) {
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  if (s.kind === 'image' && image) {
    ctx.fillStyle = css(RGB_OF.deep)
    ctx.fillRect(0, 0, w, h)
    drawImageCover(ctx, w, h, image)
  } else if (s.kind === 'ascii') {
    drawAsciiText(ctx, w, h, s.asciiText, css(RGB_OF[s.asciiFg]), css(RGB_OF[s.asciiBg]))
  } else {
    drawGenerated(ctx, w, h, s)
  }
}

export function sourceKey(w: number, h: number, s: SourceState, imageId: number) {
  return [w, h, s.kind, s.ramp, s.seed, s.spots, s.horizon, s.kind === 'ascii' ? s.asciiText : '', s.asciiFg, s.asciiBg, imageId].join('|')
}
