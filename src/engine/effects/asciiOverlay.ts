import { css, toHex } from '../palette'
import { drawAsciiText } from '../source'
import type { EffectModule } from '../types'
import { bool, color, num, str } from './util'

export const DEFAULT_ASCII_ART = String.raw`  ~~~~      ~~~~      ~~~~
 ~    ~    ~    ~    ~    ~
~      ~~~~      ~~~~      ~
     R I P P L Y N
~      ~~~~      ~~~~      ~
 ~    ~    ~    ~    ~    ~
  ~~~~      ~~~~      ~~~~`

/** Your own ASCII art laid over the result, optionally riding the same wave. */
export const asciiOverlay: EffectModule = {
  id: 'asciiOverlay',
  name: 'ASCII-оверлей',
  description: 'Свой ASCII-арт текстом поверх результата. «По волне» режет текст теми же полосами.',
  params: [
    { key: 'text', label: 'ASCII-арт', type: 'text', default: DEFAULT_ASCII_ART, rows: 6 },
    { key: 'color', label: 'Цвет', type: 'color', default: 'off' },
    { key: 'scale', label: 'Масштаб', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.6 },
    { key: 'opacity', label: 'Непрозрачность', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
    { key: 'ride', label: 'По волне', type: 'switch', default: false },
  ],
  apply(fc, p) {
    const { ctx, w, h, strips } = fc
    const text = str(p, 'text')
    if (!text.trim()) return
    const fill = css(color(p, 'color'))
    const opts = { scale: num(p, 'scale') }
    ctx.save()
    ctx.globalAlpha = num(p, 'opacity')
    if (bool(p, 'ride')) {
      const layer = fc.scratch('ascii-overlay', w, h)
      const lctx = layer.getContext('2d')!
      lctx.clearRect(0, 0, w, h)
      drawAsciiText(lctx, w, h, text, fill, null, opts)
      // only the shifted strips, no edge stretching for a transparent layer
      for (const s of strips) ctx.drawImage(layer, s.x, 0, s.w, h, s.x, s.offset, s.w, h)
    } else {
      drawAsciiText(ctx, w, h, text, fill, null, opts)
    }
    ctx.restore()
  },
  svg(sc, p) {
    if (bool(p, 'ride')) return null
    const lines = str(p, 'text').replace(/\t/g, '  ').split('\n')
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    if (!lines.length) return ''
    const cols = Math.max(1, ...lines.map((l) => l.length))
    const size = Math.min((sc.w * 0.88) / (cols * 0.6), (sc.h * 0.88) / (lines.length * 1.15)) * num(p, 'scale')
    const x0 = (sc.w - cols * size * 0.6) / 2
    const y0 = (sc.h - lines.length * size * 1.15) / 2
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const tspans = lines.map((l, i) => `<tspan x="${x0.toFixed(1)}" y="${(y0 + i * size * 1.15).toFixed(1)}">${esc(l)}</tspan>`).join('')
    return `<text xml:space="preserve" font-family="Geist Mono, ui-monospace, monospace" font-weight="500" font-size="${size.toFixed(2)}" dominant-baseline="hanging" fill="${toHex(color(p, 'color'))}" opacity="${num(p, 'opacity')}">${tspans}</text>`
  },
}
