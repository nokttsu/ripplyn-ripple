import type { EffectModule, EffectState } from '../types'
import { ascii } from './ascii'
import { asciiOverlay } from './asciiOverlay'
import { blur } from './blur'
import { dither } from './dither'
import { gradientMap } from './gradientMap'
import { grain } from './grain'
import { mirror } from './mirror'
import { phase } from './phase'

/** Registry order is the layer order: each enabled effect is applied on top of the previous result. */
export const EFFECTS: EffectModule[] = [blur, mirror, phase, gradientMap, dither, ascii, asciiOverlay, grain]

export const EFFECT_BY_ID: Record<string, EffectModule> = Object.fromEntries(EFFECTS.map((e) => [e.id, e]))

export function defaultEffectState(e: EffectModule, enabled = false): EffectState {
  return { enabled, params: Object.fromEntries(e.params.map((p) => [p.key, p.default])) }
}
