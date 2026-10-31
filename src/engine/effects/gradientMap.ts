import { sampleRamp } from '../palette'
import type { EffectModule } from '../types'
import { bool, luma, num, ramp } from './util'

/** Maps luminance onto a 2–4 colour brand ramp. */
export const gradientMap: EffectModule = {
  id: 'gradientMap',
  name: 'Перекраска в палитру',
  description: 'Gradient map: яркость исходника → 2–4 цвета палитры.',
  heavy: true,
  params: [
    { key: 'ramp', label: 'Палитра', type: 'ramp', default: 'deep-slate-off' },
    { key: 'contrast', label: 'Контраст', type: 'range', min: 0.5, max: 2.5, step: 0.05, default: 1 },
    { key: 'invert', label: 'Инвертировать', type: 'switch', default: false },
    { key: 'mix', label: 'Сила', type: 'range', min: 0, max: 1, step: 0.01, default: 1 },
  ],
  apply(fc, p) {
    const { ctx, w, h } = fc
    const stops = ramp(p, 'ramp')
    const contrast = num(p, 'contrast')
    const inv = bool(p, 'invert')
    const m = num(p, 'mix')
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    // packed RGBA lookup, written as one 32-bit word per pixel
    const lut32 = new Uint32Array(256)
    const lutBytes = new Uint8ClampedArray(lut32.buffer)
    for (let i = 0; i < 256; i++) {
      let v = (i / 255 - 0.5) * contrast + 0.5
      if (inv) v = 1 - v
      const c = sampleRamp(stops, v)
      lutBytes.set([c[0], c[1], c[2], 255], i * 4)
    }
    if (m >= 1) {
      const px = new Uint32Array(d.buffer, d.byteOffset, d.length >> 2)
      for (let i = 0, j = 0; i < px.length; i++, j += 4) px[i] = lut32[luma(d[j], d[j + 1], d[j + 2])]
    } else {
      for (let i = 0; i < d.length; i += 4) {
        const l = luma(d[i], d[i + 1], d[i + 2]) * 4
        d[i] += (lutBytes[l] - d[i]) * m
        d[i + 1] += (lutBytes[l + 1] - d[i + 1]) * m
        d[i + 2] += (lutBytes[l + 2] - d[i + 2]) * m
      }
    }
    ctx.putImageData(img, 0, 0)
  },
}
