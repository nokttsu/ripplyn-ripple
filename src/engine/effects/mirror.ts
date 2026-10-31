import type { EffectModule } from '../types'
import { copyOf, num, str } from './util'

/** Deterministic 0…1 hash for band j. */
const hash = (j: number) => {
  const x = Math.sin(j * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Gerhard Richter, Strip: strips are mirrored, or thin vertical slices are stretched into horizontal bands. */
export const mirror: EffectModule = {
  id: 'mirror',
  name: 'Mirror',
  description: 'Как у Рихтера: зеркалим полосы или растягиваем узкие вертикальные срезы в горизонтальные полосы.',
  params: [
    {
      key: 'mode',
      label: 'Режим',
      type: 'select',
      default: 'flip',
      options: [
        { value: 'flip', label: 'Каждая полоса зеркально' },
        { value: 'alternate', label: 'Через одну' },
        { value: 'symmetry', label: 'Симметрия половин' },
        { value: 'horizontal', label: 'Горизонтальные полосы' },
      ],
    },
    { key: 'bands', label: 'Горизонтальных полос', type: 'range', min: 2, max: 9, step: 1, default: 6, pow2: true },
    { key: 'sliceX', label: 'Позиция среза', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'scatter', label: 'Разброс срезов', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: 'sliceW', label: 'Ширина среза', type: 'range', min: 1, max: 64, step: 1, default: 2, unit: 'px' },
  ],
  apply(fc, p) {
    const { ctx, w, h, strips, unit } = fc
    const mode = str(p, 'mode')
    const copy = copyOf(fc, 'mirror')
    if (mode === 'horizontal') {
      // each band is a thin vertical slice of the rippled image stretched to full width
      const n = 2 ** Math.round(num(p, 'bands'))
      const sw = Math.max(1, num(p, 'sliceW') * unit)
      const scatter = num(p, 'scatter')
      ctx.imageSmoothingEnabled = true
      for (let j = 0; j < n; j++) {
        const y0 = Math.round((j * h) / n)
        const y1 = Math.round(((j + 1) * h) / n)
        let x = num(p, 'sliceX') + scatter * (hash(j) - 0.5)
        x -= Math.floor(x)
        const sx = Math.min(w - sw, Math.max(0, x * w - sw / 2))
        ctx.drawImage(copy, sx, y0, sw, y1 - y0, 0, y0, w, y1 - y0)
      }
      return
    }
    if (mode === 'symmetry') {
      const half = Math.floor(w / 2)
      ctx.save()
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(copy, 0, 0, half, h, 0, 0, half, h)
      ctx.restore()
      return
    }
    strips.forEach((s, i) => {
      if (mode === 'alternate' && i % 2 === 0) return
      ctx.save()
      ctx.translate(s.x + s.w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(copy, s.x, 0, s.w, h, 0, 0, s.w, h)
      ctx.restore()
    })
  },
  // In SVG each strip is a single sampled column, so flipping it is a no-op.
  svg: (_sc, p) => (p.mode === 'flip' || p.mode === 'alternate' ? '' : null),
}
