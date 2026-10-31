import { css, sampleRamp, toHex, type RGB } from '../palette'
import type { EffectModule, ParamValues, Strip } from '../types'
import { num, ramp, str } from './util'

const BLENDS: Record<string, GlobalCompositeOperation> = {
  color: 'color',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft-light': 'soft-light',
  normal: 'source-over',
}

function stripColors(strips: Strip[], p: ParamValues, t: number, pointerX: number): RGB[] {
  const stops = ramp(p, 'ramp')
  const spread = num(p, 'spread')
  const speed = num(p, 'speed')
  const follow = num(p, 'pointer')
  return strips.map((s) => {
    const v = s.cx * spread + pointerX * follow + t * speed
    const f = v - Math.floor(v)
    // ping-pong through the ramp so the cycle has no seam
    return sampleRamp(stops, 1 - Math.abs(2 * f - 1))
  })
}

/** Carlos Cruz-Diez, Physichromie: strip colour phase shifts with time and pointer position. */
export const phase: EffectModule = {
  id: 'phase',
  name: 'Phase color',
  description: 'Как у Круз-Диеса: цвет полос сдвигается по палитре от курсора и времени. Проведите по канвасу.',
  params: [
    { key: 'ramp', label: 'Палитра', type: 'ramp', default: 'deep-slate-signal-off' },
    { key: 'spread', label: 'Разброс по полосам', type: 'range', min: 0, max: 4, step: 0.05, default: 1 },
    { key: 'speed', label: 'Скорость', type: 'range', min: 0, max: 1, step: 0.01, default: 0.08 },
    { key: 'pointer', label: 'Влияние курсора', type: 'range', min: 0, max: 2, step: 0.05, default: 0.6 },
    { key: 'opacity', label: 'Непрозрачность', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    {
      key: 'blend',
      label: 'Смешивание',
      type: 'select',
      default: 'color',
      options: Object.keys(BLENDS).map((b) => ({ value: b, label: b })),
    },
  ],
  apply(fc, p) {
    const { ctx, h, strips, t, pointer } = fc
    const cols = stripColors(strips, p, t, pointer.x)
    ctx.save()
    ctx.globalCompositeOperation = BLENDS[str(p, 'blend')] ?? 'color'
    ctx.globalAlpha = num(p, 'opacity')
    strips.forEach((s, i) => {
      ctx.fillStyle = css(cols[i])
      ctx.fillRect(s.x, 0, s.w, h)
    })
    ctx.restore()
  },
  svg(sc, p) {
    const cols = stripColors(sc.strips, p, sc.t, sc.pointer.x)
    const blend = str(p, 'blend') === 'normal' ? 'normal' : str(p, 'blend')
    const op = num(p, 'opacity').toFixed(3)
    const rects = sc.strips.map((s, i) => `<rect x="${s.x}" y="0" width="${s.w}" height="${sc.h}" fill="${toHex(cols[i])}"/>`).join('')
    return `<g opacity="${op}" style="mix-blend-mode:${blend}">${rects}</g>`
  },
}
