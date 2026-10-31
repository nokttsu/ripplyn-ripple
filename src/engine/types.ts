import type { ColorToken, RampId, RGB } from './palette'

export type ParamValue = number | boolean | string

/** Declarative parameter description — the settings panel is generated from these. */
export type ParamDef =
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number; default: number; unit?: string; pow2?: boolean }
  | { key: string; label: string; type: 'switch'; default: boolean }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; default: string }
  | { key: string; label: string; type: 'color'; default: ColorToken }
  | { key: string; label: string; type: 'ramp'; default: RampId }
  | { key: string; label: string; type: 'text'; default: string; rows?: number; placeholder?: string }

export type ParamValues = Record<string, ParamValue>

export interface Strip {
  /** left edge, px */
  x: number
  /** width, px */
  w: number
  /** normalized centre, 0…1 */
  cx: number
  /** vertical offset, px */
  offset: number
  /** d(offset)/dt, px per second */
  velocity: number
  /** distance from impact point, 0…1 */
  dist: number
}

export interface CoreParams {
  /** strips = 2^stripsExp, 1…9 → 2…512 */
  stripsExp: number
  /** amplitude as a fraction of canvas height */
  amp: number
  /** wave frequency (half-periods across dist 0…1) */
  freq: number
  /** wave speed, radians per second */
  speed: number
  /** impact point, normalized */
  impactX: number
  impactY: number
}

export interface FrameContext {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  /** pixel scale relative to the 1280 px reference width — keeps sizes consistent between preview and export */
  unit: number
  /** animation time, seconds */
  t: number
  core: CoreParams
  strips: Strip[]
  /** pointer position over canvas, normalized; defaults to 0.5,0.5 */
  pointer: { x: number; y: number }
  /** source image at canvas resolution (before slicing) */
  source: HTMLCanvasElement
  /** scratch canvases, keyed by name, reused between frames */
  scratch: (name: string, w?: number, h?: number) => HTMLCanvasElement
}

export interface SvgContext {
  w: number
  h: number
  strips: Strip[]
  t: number
  pointer: { x: number; y: number }
}

/**
 * One effect = one module. Add a file in src/engine/effects, export an EffectModule
 * and register it in effects/index.ts — the panel, presets, URL state and randomize pick it up.
 */
export interface EffectModule {
  id: string
  name: string
  description?: string
  params: ParamDef[]
  /** heavy effects touch pixels via getImageData; the preview throttles them adaptively */
  heavy?: boolean
  apply(fc: FrameContext, p: ParamValues): void
  /**
   * SVG counterpart. Return an SVG fragment drawn on top of the strips, '' when the effect
   * has no visible vector effect, or null when the current settings cannot be expressed as vectors.
   * Omit entirely for raster-only effects.
   */
  svg?(sc: SvgContext, p: ParamValues): string | null
}

export type Aspect = '16:9' | '1:1' | '4:5' | '9:16'

export type SourceKind = 'generated' | 'image' | 'ascii'

export interface SourceState {
  kind: SourceKind
  ramp: RampId
  seed: number
  spots: number
  horizon: boolean
  asciiText: string
  asciiFg: ColorToken
  asciiBg: ColorToken
}

export interface EffectState {
  enabled: boolean
  params: ParamValues
}

export interface AppState {
  aspect: Aspect
  source: SourceState
  core: CoreParams
  effects: Record<string, EffectState>
}

export type { RGB }
