import { DEFAULT_ASCII_ART } from './effects/asciiOverlay'
import { defaultEffectState, EFFECT_BY_ID, EFFECTS } from './effects'
import { COLOR_TOKENS, RAMP_IDS } from './palette'
import type { AppState, Aspect, ParamDef, ParamValue } from './types'

export const ASPECTS: Aspect[] = ['16:9', '1:1', '4:5', '9:16']

export function aspectRatio(a: Aspect) {
  const [x, y] = a.split(':').map(Number)
  return x / y
}

export function defaultState(): AppState {
  return {
    aspect: '16:9',
    source: {
      kind: 'generated',
      ramp: 'deep-slate-signal-off',
      seed: 7,
      spots: 6,
      horizon: true,
      asciiText: DEFAULT_ASCII_ART,
      asciiFg: 'off',
      asciiBg: 'slate',
    },
    core: { stripsExp: 6, amp: 0.12, freq: 3, speed: 1.2, impactX: 0.5, impactY: 0.5 },
    effects: Object.fromEntries(EFFECTS.map((e) => [e.id, defaultEffectState(e)])),
  }
}

type EffectPatch = Record<string, { enabled?: boolean; params?: Record<string, ParamValue> }>

function preset(patch: Partial<Omit<AppState, 'effects' | 'source' | 'core'>> & { source?: Partial<AppState['source']>; core?: Partial<AppState['core']>; effects?: EffectPatch }): AppState {
  const s = defaultState()
  if (patch.aspect) s.aspect = patch.aspect
  Object.assign(s.source, patch.source)
  Object.assign(s.core, patch.core)
  for (const [id, ep] of Object.entries(patch.effects ?? {})) {
    if (!s.effects[id]) continue
    if (ep.enabled !== undefined) s.effects[id].enabled = ep.enabled
    Object.assign(s.effects[id].params, ep.params)
  }
  return s
}

export const PRESETS: { id: string; name: string; build: () => AppState }[] = [
  {
    id: 'calm-slate',
    name: 'Calm slate',
    build: () =>
      preset({
        source: { ramp: 'deep-slate-off', seed: 11, spots: 5 },
        core: { stripsExp: 7, amp: 0.06, freq: 2, speed: 0.6 },
        effects: { grain: { enabled: true, params: { amount: 0.1 } } },
      }),
  },
  {
    id: 'signal-wave',
    name: 'Signal wave',
    build: () =>
      preset({
        source: { ramp: 'deep-signal-off', seed: 23, spots: 7 },
        core: { stripsExp: 6, amp: 0.22, freq: 4, speed: 1.8 },
        effects: { blur: { enabled: true, params: { strength: 1 } } },
      }),
  },
  {
    id: 'ascii-field',
    name: 'ASCII field',
    build: () =>
      preset({
        source: { ramp: 'deep-slate-signal-off', seed: 5 },
        core: { stripsExp: 5, amp: 0.14, freq: 3, speed: 1.1 },
        effects: { ascii: { enabled: true, params: { cell: 9, fg: 'signal', bg: 'deep', charset: '@%#*+=-:. ' } } },
      }),
  },
  {
    id: 'richter-strips',
    name: 'Richter strips',
    build: () =>
      preset({
        source: { ramp: 'deep-slate-signal-off', seed: 41, spots: 9 },
        core: { stripsExp: 9, amp: 0.09, freq: 5, speed: 0.5 },
        effects: { mirror: { enabled: true, params: { mode: 'horizontal', bands: 7, sliceX: 0.42, scatter: 0.9, sliceW: 1 } } },
      }),
  },
  {
    id: 'cruz-phase',
    name: 'Cruz phase',
    build: () =>
      preset({
        source: { ramp: 'slate-off', seed: 3 },
        core: { stripsExp: 6, amp: 0.05, freq: 2, speed: 0.7 },
        effects: {
          mirror: { enabled: true, params: { mode: 'alternate' } },
          phase: { enabled: true, params: { ramp: 'deep-slate-signal-off', opacity: 0.7, blend: 'color', spread: 1.5 } },
        },
      }),
  },
  {
    id: 'dither-tide',
    name: 'Dither tide',
    build: () =>
      preset({
        source: { ramp: 'deep-signal-off', seed: 17 },
        core: { stripsExp: 5, amp: 0.16, freq: 3, speed: 1 },
        effects: { dither: { enabled: true, params: { mode: 'bayer8', ramp: 'deep-slate-signal-off', pixel: 4 } } },
      }),
  },
]

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]

function randomParam(d: ParamDef): ParamValue {
  switch (d.type) {
    case 'range': {
      const v = rnd(d.min, d.max)
      return Math.round(v / d.step) * d.step
    }
    case 'switch':
      return Math.random() < 0.5
    case 'select':
      return pick(d.options).value
    case 'color':
      return pick(COLOR_TOKENS)
    case 'ramp':
      return pick(RAMP_IDS)
    case 'text':
      return d.default
  }
}

export function randomState(prev: AppState): AppState {
  const s = defaultState()
  s.aspect = prev.aspect
  s.source = { ...prev.source, ramp: pick(RAMP_IDS), seed: Math.floor(Math.random() * 1e6), spots: Math.round(rnd(2, 10)) }
  s.core = { stripsExp: Math.round(rnd(3, 8)), amp: +rnd(0.03, 0.25).toFixed(3), freq: +rnd(1, 6).toFixed(2), speed: +rnd(0.3, 2.2).toFixed(2), impactX: +rnd(0.15, 0.85).toFixed(3), impactY: 0.5 }
  // 0–2 effects, never two full-frame replacements at once
  const pool = EFFECTS.filter((e) => e.id !== 'asciiOverlay')
  const count = Math.floor(rnd(0, 3))
  const chosen = new Set<string>()
  while (chosen.size < count) chosen.add(pick(pool).id)
  if (chosen.has('ascii') && chosen.has('dither')) chosen.delete('dither')
  for (const id of chosen) {
    const e = EFFECT_BY_ID[id]
    s.effects[id] = { enabled: true, params: Object.fromEntries(e.params.map((d) => [d.key, randomParam(d)])) }
  }
  if (s.effects.ascii.enabled) s.effects.ascii.params.charset = EFFECT_BY_ID.ascii.params[0].default as string
  return s
}

/* ---------- URL state ---------- */

const b64e = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64d = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

/** Only non-default values are written, so links stay short. */
export function encodeState(s: AppState): string {
  const d = defaultState()
  const out: Record<string, unknown> = {}
  if (s.aspect !== d.aspect) out.a = s.aspect
  const src: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s.source)) if ((d.source as unknown as Record<string, unknown>)[k] !== v) src[k] = v
  if (src.kind === 'image') delete src.kind
  if (Object.keys(src).length) out.s = src
  const core: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s.core)) if ((d.core as unknown as Record<string, unknown>)[k] !== v) core[k] = v
  if (Object.keys(core).length) out.c = core
  const fx: Record<string, unknown> = {}
  for (const [id, es] of Object.entries(s.effects)) {
    if (!es.enabled) continue
    const pd = d.effects[id]?.params ?? {}
    fx[id] = Object.fromEntries(Object.entries(es.params).filter(([k, v]) => pd[k] !== v))
  }
  if (Object.keys(fx).length) out.e = fx
  return b64e(JSON.stringify(out))
}

export function decodeState(hash: string): AppState | null {
  try {
    const m = hash.match(/s=([A-Za-z0-9_-]+)/)
    if (!m) return null
    const o = JSON.parse(b64d(m[1]))
    const s = defaultState()
    if (ASPECTS.includes(o.a)) s.aspect = o.a
    Object.assign(s.source, o.s)
    Object.assign(s.core, o.c)
    for (const [id, params] of Object.entries((o.e ?? {}) as Record<string, Record<string, ParamValue>>)) {
      if (!s.effects[id]) continue
      s.effects[id].enabled = true
      Object.assign(s.effects[id].params, params)
    }
    return s
  } catch {
    return null
  }
}

export function shareUrl(s: AppState) {
  const u = new URL(window.location.href)
  u.hash = 's=' + encodeState(s)
  return u.toString()
}
