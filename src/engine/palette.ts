export type RGB = [number, number, number]

export const PALETTE = {
  slate: '#556B80',
  off: '#FBFAF7',
  deep: '#181D21',
  signal: '#489FC6',
} as const

export type ColorToken = keyof typeof PALETTE

export const COLOR_TOKENS = Object.keys(PALETTE) as ColorToken[]

export const COLOR_LABELS: Record<ColorToken, string> = {
  slate: 'Slate',
  off: 'Off-white',
  deep: 'Deep',
  signal: 'Signal',
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const RGB_OF: Record<ColorToken, RGB> = {
  slate: hexToRgb(PALETTE.slate),
  off: hexToRgb(PALETTE.off),
  deep: hexToRgb(PALETTE.deep),
  signal: hexToRgb(PALETTE.signal),
}

/** Ordered 2–4 colour ramps built only from the brand palette (dark → light). */
export const RAMPS = {
  'deep-slate-off': ['deep', 'slate', 'off'],
  'deep-signal-off': ['deep', 'signal', 'off'],
  'deep-slate-signal-off': ['deep', 'slate', 'signal', 'off'],
  'slate-off': ['slate', 'off'],
  'deep-slate': ['deep', 'slate'],
  'slate-signal': ['slate', 'signal'],
  'deep-off': ['deep', 'off'],
  'signal-off': ['signal', 'off'],
} as const satisfies Record<string, readonly ColorToken[]>

export type RampId = keyof typeof RAMPS

export const RAMP_IDS = Object.keys(RAMPS) as RampId[]

export function rampLabel(id: RampId) {
  return RAMPS[id].map((c) => COLOR_LABELS[c]).join(' → ')
}

export function rampColors(id: RampId): RGB[] {
  return RAMPS[id].map((c) => RGB_OF[c])
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Sample a ramp at t ∈ [0,1]. */
export function sampleRamp(stops: RGB[], t: number): RGB {
  t = Math.max(0, Math.min(1, t))
  if (stops.length === 1) return stops[0]
  const n = stops.length - 1
  const i = Math.min(n - 1, Math.floor(t * n))
  return mix(stops[i], stops[i + 1], t * n - i)
}

export function css(c: RGB, a = 1) {
  const r = Math.round(c[0])
  const g = Math.round(c[1])
  const b = Math.round(c[2])
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`
}

export function toHex(c: RGB) {
  return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}
