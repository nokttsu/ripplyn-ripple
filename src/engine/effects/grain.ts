import type { EffectModule } from '../types'
import { bool, num, str } from './util'

const TILE = 256
let tiles: HTMLCanvasElement[] | null = null

function noiseTiles() {
  if (tiles) return tiles
  tiles = Array.from({ length: 4 }, () => {
    const c = document.createElement('canvas')
    c.width = c.height = TILE
    const x = c.getContext('2d')!
    const img = x.createImageData(TILE, TILE)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    x.putImageData(img, 0, 0)
    return c
  })
  return tiles
}

const BLENDS: Record<string, GlobalCompositeOperation> = {
  overlay: 'overlay',
  'soft-light': 'soft-light',
  multiply: 'multiply',
  screen: 'screen',
}

/** Film grain: pre-generated noise tiles composited with a blend mode (cheap, no getImageData). */
export const grain: EffectModule = {
  id: 'grain',
  name: 'Grain / noise',
  params: [
    { key: 'amount', label: 'Сила', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18 },
    { key: 'size', label: 'Размер зерна', type: 'range', min: 1, max: 4, step: 0.25, default: 1, unit: 'px' },
    {
      key: 'blend',
      label: 'Смешивание',
      type: 'select',
      default: 'overlay',
      options: Object.keys(BLENDS).map((b) => ({ value: b, label: b })),
    },
    { key: 'animated', label: 'Анимировать', type: 'switch', default: true },
  ],
  apply(fc, p) {
    const { ctx, w, h, unit, t } = fc
    const set = noiseTiles()
    const frame = bool(p, 'animated') ? Math.floor(t * 24) : 0
    const tile = set[frame % set.length]
    const s = TILE * Math.max(0.5, num(p, 'size') * unit)
    const ox = bool(p, 'animated') ? -((frame * 97) % TILE) : 0
    const oy = bool(p, 'animated') ? -((frame * 53) % TILE) : 0
    ctx.save()
    ctx.globalCompositeOperation = BLENDS[str(p, 'blend')] ?? 'overlay'
    ctx.globalAlpha = num(p, 'amount')
    ctx.imageSmoothingEnabled = false
    for (let y = oy; y < h; y += s) for (let x = ox; x < w; x += s) ctx.drawImage(tile, x, y, s, s)
    ctx.restore()
  },
}
