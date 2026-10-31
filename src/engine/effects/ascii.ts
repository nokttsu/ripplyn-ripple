import { css } from '../palette'
import type { EffectModule } from '../types'
import { bool, color, fontState, luma, MONO, num, str } from './util'

const atlasCache = new Map<string, HTMLCanvasElement>()

/** One row of pre-rendered glyphs; drawImage from it is far cheaper than fillText per cell. */
function glyphAtlas(chars: string[], cw: number, ch: number, fill: string) {
  const key = [chars.join(''), cw, ch, fill, fontState.epoch].join('|')
  let a = atlasCache.get(key)
  if (a) return a
  if (atlasCache.size > 24) atlasCache.clear()
  a = document.createElement('canvas')
  a.width = Math.max(1, cw * chars.length)
  a.height = Math.max(1, ch)
  const c = a.getContext('2d')!
  c.font = `500 ${ch / 1.25}px ${MONO}`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = fill
  chars.forEach((g, i) => c.fillText(g, i * cw + cw / 2, ch / 2))
  atlasCache.set(key, a)
  return a
}

export const ascii: EffectModule = {
  id: 'ascii',
  name: 'ASCII-арт',
  description: 'Рендер результата в символы. Набор символов — от тёмного к светлому.',
  heavy: true,
  params: [
    { key: 'charset', label: 'Набор символов (тёмный → светлый)', type: 'text', default: '@%#*+=-:. ', rows: 1 },
    { key: 'cell', label: 'Размер ячейки', type: 'range', min: 4, max: 40, step: 1, default: 10, unit: 'px' },
    { key: 'fg', label: 'Цвет символов', type: 'color', default: 'off' },
    { key: 'bg', label: 'Цвет фона', type: 'color', default: 'deep' },
    {
      key: 'colorMode',
      label: 'Окраска символов',
      type: 'select',
      default: 'palette',
      options: [
        { value: 'palette', label: 'Цвет палитры' },
        { value: 'source', label: 'Цвет исходника' },
      ],
    },
    { key: 'overlay', label: 'Поверх изображения (без фона)', type: 'switch', default: false },
    { key: 'invert', label: 'Инвертировать яркость', type: 'switch', default: false },
    { key: 'opacity', label: 'Непрозрачность', type: 'range', min: 0, max: 1, step: 0.01, default: 1 },
  ],
  apply(fc, p) {
    const { ctx, w, h, unit } = fc
    const chars = Array.from(str(p, 'charset') || '@#*:. ')
    const cw = Math.max(2, Math.round(num(p, 'cell') * unit))
    const ch = Math.round(cw * 1.6)
    const cols = Math.ceil(w / cw)
    const rows = Math.ceil(h / ch)
    const small = fc.scratch('ascii-sample', cols, rows)
    const sctx = small.getContext('2d', { willReadFrequently: true })!
    sctx.drawImage(fc.canvas, 0, 0, cols, rows)
    const d = sctx.getImageData(0, 0, cols, rows).data

    const layer = fc.scratch('ascii-layer', w, h)
    const lctx = layer.getContext('2d')!
    const overlay = bool(p, 'overlay')
    lctx.clearRect(0, 0, w, h)
    if (!overlay) {
      lctx.fillStyle = css(color(p, 'bg'))
      lctx.fillRect(0, 0, w, h)
    }
    const inv = bool(p, 'invert')
    const last = chars.length - 1
    const fromSource = str(p, 'colorMode') === 'source'
    const atlas = fromSource ? null : glyphAtlas(chars, cw, ch, css(color(p, 'fg')))
    if (fromSource) {
      lctx.font = `500 ${ch / 1.25}px ${MONO}`
      lctx.textAlign = 'center'
      lctx.textBaseline = 'middle'
    }
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4
        let v = luma(d[i], d[i + 1], d[i + 2]) / 255
        if (inv) v = 1 - v
        const gi = Math.round(v * last)
        if (chars[gi] === ' ') continue
        if (atlas) {
          lctx.drawImage(atlas, gi * cw, 0, cw, ch, x * cw, y * ch, cw, ch)
        } else {
          lctx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`
          lctx.fillText(chars[gi], x * cw + cw / 2, y * ch + ch / 2)
        }
      }
    ctx.save()
    ctx.globalAlpha = num(p, 'opacity')
    ctx.drawImage(layer, 0, 0)
    ctx.restore()
  },
}

