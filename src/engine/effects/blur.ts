import type { EffectModule } from '../types'
import { copyOf, num } from './util'

/** Vertical motion blur per strip, proportional to the strip's instantaneous speed. */
export const blur: EffectModule = {
  id: 'blur',
  name: 'Blur полос',
  description: 'Motion blur по вертикали: чем быстрее движется полоса, тем сильнее смаз.',
  params: [
    { key: 'strength', label: 'Сила', type: 'range', min: 0, max: 2, step: 0.05, default: 0.8 },
    { key: 'base', label: 'Базовый смаз', type: 'range', min: 0, max: 0.1, step: 0.005, default: 0.01 },
    { key: 'samples', label: 'Сэмплы', type: 'range', min: 3, max: 16, step: 1, default: 8 },
  ],
  apply(fc, p) {
    const { ctx, h, strips } = fc
    const strength = num(p, 'strength')
    const base = num(p, 'base') * h
    const samples = Math.round(num(p, 'samples'))
    const copy = copyOf(fc, 'blur')
    for (const s of strips) {
      // shutter ≈ 1/12 s
      const len = Math.abs(s.velocity) * strength * 0.083 + base
      if (len < 0.75 || s.w <= 0) continue
      for (let k = 0; k < samples; k++) {
        const dy = (k / (samples - 1) - 0.5) * len
        ctx.globalAlpha = 1 / (k + 1)
        const sy = Math.max(0, -dy)
        const sh = h - Math.abs(dy)
        ctx.drawImage(copy, s.x, sy, s.w, sh, s.x, sy + dy, s.w, sh)
      }
    }
    ctx.globalAlpha = 1
  },
}
