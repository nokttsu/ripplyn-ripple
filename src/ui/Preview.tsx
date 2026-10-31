import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Renderer } from '../engine/renderer'
import { aspectRatio } from '../engine/state'
import type { AppState } from '../engine/types'

const MAX_PREVIEW_SIDE = 1920

export interface PreviewProps {
  state: AppState
  playing: boolean
  renderer: Renderer
  timeRef: MutableRefObject<number>
  pointerRef: MutableRefObject<{ x: number; y: number }>
  onImpact: (x: number, y: number) => void
  onFile: (f: File) => void
  onFps?: (fps: number) => void
}

export function Preview({ state, playing, renderer, timeRef, pointerRef, onImpact, onFile, onFps }: PreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState(false)
  const stateRef = useRef(state)
  const playingRef = useRef(playing)
  const dirty = useRef(true)

  // hand the latest props to the rAF loop and request a redraw
  useLayoutEffect(() => {
    stateRef.current = state
    playingRef.current = playing
    dirty.current = true
  }, [state, playing])

  // fit the canvas into the available box keeping the aspect ratio
  useLayoutEffect(() => {
    const box = boxRef.current!
    const fit = () => {
      const r = aspectRatio(state.aspect)
      const bw = box.clientWidth
      const bh = box.clientHeight
      let w = bw
      let h = w / r
      if (h > bh) {
        h = bh
        w = h * r
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [state.aspect])

  useEffect(() => {
    const c = canvasRef.current!
    if (!size.w || !size.h) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = Math.round(size.w * dpr)
    let h = Math.round(size.h * dpr)
    const k = Math.min(1, MAX_PREVIEW_SIDE / Math.max(w, h))
    w = Math.round(w * k)
    h = Math.round(h * k)
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
    dirty.current = true
  }, [size])

  // render loop: time advances only while playing; heavy effects are throttled adaptively
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastRender = 0
    let ema = 4
    let frames = 0
    let fpsT = last
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (playingRef.current) timeRef.current += dt
      const c = canvasRef.current
      if (!c || !c.width) return
      if (!playingRef.current && !dirty.current) return
      const minGap = renderer.heavyEnabled(stateRef.current) ? Math.max(0, ema * 1.4) : 0
      if (now - lastRender < minGap && !dirty.current) return
      const t0 = performance.now()
      renderer.render(c, stateRef.current, timeRef.current, pointerRef.current)
      const took = performance.now() - t0
      ema = ema * 0.85 + took * 0.15
      lastRender = now
      dirty.current = false
      frames++
      if (now - fpsT > 1000) {
        onFps?.(Math.round((frames * 1000) / (now - fpsT)))
        frames = 0
        fpsT = now
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [renderer, timeRef, pointerRef, onFps])

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  return (
    <div
      ref={boxRef}
      className="relative flex h-full w-full items-center justify-center max-[900px]:items-start"
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer.files?.[0]
        if (f && f.type.startsWith('image/')) onFile(f)
      }}
    >
      <div className="relative" style={{ width: size.w, height: size.h }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-crosshair rounded-md bg-slate"
          aria-label="Превью: исходник, нарезанный на полосы и сдвинутый волной. Клик переставляет точку удара."
          onPointerMove={(e) => {
            pointerRef.current = norm(e)
            dirty.current = true
          }}
          onPointerLeave={() => (pointerRef.current = { x: 0.5, y: 0.5 })}
          onClick={(e) => {
            const p = norm(e)
            onImpact(p.x, p.y)
          }}
        />
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-off shadow-[0_0_0_1px_rgba(24,29,33,.5)]"
          style={{ left: `${state.core.impactX * 100}%`, top: `${state.core.impactY * 100}%` }}
          aria-hidden
        />
        {drag && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-signal bg-off/70 text-sm font-medium">
            Отпустите, чтобы загрузить исходник
          </div>
        )}
      </div>
    </div>
  )
}
