import { RGB_OF, rampColors, type ColorToken, type RampId, type RGB } from '../palette'
import type { ParamValues } from '../types'

export const num = (p: ParamValues, k: string) => Number(p[k])
export const bool = (p: ParamValues, k: string) => Boolean(p[k])
export const str = (p: ParamValues, k: string) => String(p[k])
export const color = (p: ParamValues, k: string): RGB => RGB_OF[(p[k] as ColorToken) ?? 'deep'] ?? RGB_OF.deep
export const ramp = (p: ParamValues, k: string): RGB[] => rampColors((p[k] as RampId) ?? 'deep-slate-off')

/** Rec. 709 luma, 0…255 */
export const luma = (r: number, g: number, b: number) => (r * 54 + g * 183 + b * 19) >> 8

export function copyOf(fc: { canvas: HTMLCanvasElement; scratch: (n: string, w?: number, h?: number) => HTMLCanvasElement; w: number; h: number }, name = 'copy') {
  const c = fc.scratch(name, fc.w, fc.h)
  const cx = c.getContext('2d')!
  cx.clearRect(0, 0, fc.w, fc.h)
  cx.drawImage(fc.canvas, 0, 0)
  return c
}

/** Counter bumped when web fonts finish loading so glyph caches rebuild. */
export const fontState = { epoch: 0 }
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    fontState.epoch++
  })
  document.fonts.load('500 16px "Geist Mono"').then(() => {
    fontState.epoch++
  })
}

export const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
