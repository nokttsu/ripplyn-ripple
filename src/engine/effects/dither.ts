import { css } from '../palette'
import type { EffectModule } from '../types'
import { luma, num, ramp, str } from './util'

const bayer = (n: number): number[] => {
  if (n === 2) return [0, 2, 3, 1]
  const prev = bayer(n / 2)
  const h = n / 2
  const out = new Array(n * n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const q = (y < h ? 0 : 2) + (x < h ? 0 : 1)
      out[y * n + x] = 4 * prev[(y % h) * h + (x % h)] + [0, 2, 3, 1][q]
    }
  return out
}
const BAYER: Record<number, Float32Array> = {}
function bayerNorm(n: number) {
  if (!BAYER[n]) BAYER[n] = Float32Array.from(bayer(n), (v) => (v + 0.5) / (n * n) - 0.5)
  return BAYER[n]
}

/** Halftone and ordered / error-diffusion dithering, quantized to brand-palette colours. */
export const dither: EffectModule = {
  id: 'dither',
  name: 'Halftone / dither',
  description: 'Bayer, Floyd–Steinberg или растровые точки; цвета берутся из палитры.',
  heavy: true,
  params: [
    {
      key: 'mode',
      label: 'Режим',
      type: 'select',
      default: 'bayer4',
      options: [
        { value: 'bayer4', label: 'Bayer 4×4' },
        { value: 'bayer8', label: 'Bayer 8×8' },
        { value: 'floyd', label: 'Floyd–Steinberg' },
        { value: 'halftone', label: 'Halftone (точки)' },
      ],
    },
    { key: 'ramp', label: 'Палитра', type: 'ramp', default: 'deep-slate-off' },
    { key: 'pixel', label: 'Размер пикселя', type: 'range', min: 1, max: 24, step: 1, default: 3, unit: 'px' },
    { key: 'contrast', label: 'Контраст', type: 'range', min: 0.5, max: 2.5, step: 0.05, default: 1.1 },
  ],
  apply(fc, p) {
    const { ctx, w, h, unit } = fc
    const stops = ramp(p, 'ramp')
    const levels = stops.length
    const px = Math.max(1, num(p, 'pixel') * unit)
    const contrast = num(p, 'contrast')
    const mode = str(p, 'mode')
    const sw = Math.max(1, Math.ceil(w / px))
    const sh = Math.max(1, Math.ceil(h / px))
    const small = fc.scratch('dither', sw, sh)
    const sctx = small.getContext('2d', { willReadFrequently: true })!
    sctx.imageSmoothingEnabled = true
    sctx.drawImage(fc.canvas, 0, 0, sw, sh)
    const img = sctx.getImageData(0, 0, sw, sh)
    const d = img.data
    const n = sw * sh
    const L = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const v = luma(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255
      L[i] = (v - 0.5) * contrast + 0.5
    }

    if (mode === 'halftone') {
      const paper = stops[stops.length - 1]
      const ink = stops[0]
      ctx.fillStyle = css(paper)
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = css(ink)
      ctx.beginPath()
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          const dark = 1 - Math.max(0, Math.min(1, L[y * sw + x]))
          if (dark < 0.02) continue
          const r = Math.sqrt(dark) * px * 0.72
          const cx = (x + 0.5) * px
          const cy = (y + 0.5) * px
          ctx.moveTo(cx + r, cy)
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
        }
      ctx.fill()
      return
    }

    const q = levels - 1
    if (mode === 'floyd') {
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          const i = y * sw + x
          const old = L[i]
          const lv = Math.max(0, Math.min(q, Math.round(old * q)))
          const err = old - lv / q
          L[i] = lv
          if (x + 1 < sw) L[i + 1] += (err * 7) / 16
          if (y + 1 < sh) {
            if (x > 0) L[i + sw - 1] += (err * 3) / 16
            L[i + sw] += (err * 5) / 16
            if (x + 1 < sw) L[i + sw + 1] += err / 16
          }
        }
    } else {
      const bn = mode === 'bayer8' ? 8 : 4
      const m = bayerNorm(bn)
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          const i = y * sw + x
          const v = L[i] * q + m[(y % bn) * bn + (x % bn)]
          L[i] = Math.max(0, Math.min(q, Math.round(v)))
        }
    }
    for (let i = 0; i < n; i++) {
      const c = stops[L[i]]
      d[i * 4] = c[0]
      d[i * 4 + 1] = c[1]
      d[i * 4 + 2] = c[2]
      d[i * 4 + 3] = 255
    }
    sctx.putImageData(img, 0, 0)
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, sw, sh, 0, 0, sw * px, sh * px)
    ctx.restore()
  },
}
