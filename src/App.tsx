import { Button, Drawer, Tabs } from '@heroui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportPNG, exportSVG, exportVideo } from './engine/export'
import { Renderer } from './engine/renderer'
import { ASPECTS, decodeState, defaultState, encodeState, randomState, shareUrl } from './engine/state'
import type { AppState, Aspect } from './engine/types'
import { Panel } from './ui/Panel'
import { Preview } from './ui/Preview'

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

const PlayIcon = ({ playing }: { playing: boolean }) =>
  playing ? (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
      <rect x="3" y="2" width="3.5" height="12" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
      <path d="M4 2.5v11a.7.7 0 0 0 1.06.6l9-5.5a.7.7 0 0 0 0-1.2l-9-5.5A.7.7 0 0 0 4 2.5Z" />
    </svg>
  )

export default function App() {
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [state, setStateRaw] = useState<AppState>(() => decodeState(window.location.hash) ?? defaultState())
  const [playing, setPlaying] = useState(!reduceMotion)
  const [imageName, setImageName] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const renderer = useMemo(() => new Renderer(), [])
  const timeRef = useRef(0)
  const pointerRef = useRef({ x: 0.5, y: 0.5 })
  const mobile = useMedia('(max-width: 900px)')

  const setState = useCallback((fn: (s: AppState) => AppState) => setStateRaw(fn), [])

  // keep the URL in sync (debounced) so the address bar is always a shareable link
  useEffect(() => {
    const id = setTimeout(() => {
      const enc = encodeState(state)
      // 'e30' is an empty object: default settings need no hash
      history.replaceState(null, '', enc === 'e30' ? location.pathname + location.search : '#s=' + enc)
    }, 300)
    return () => clearTimeout(id)
  }, [state])

  if (import.meta.env.DEV) Object.assign(window, { __ripple: { renderer, setState, state } })

  const onFile = useCallback(
    (f: File) => {
      const url = URL.createObjectURL(f)
      const img = new Image()
      img.onload = () => {
        renderer.setImage(img)
        setImageName(f.name)
        setState((s) => ({ ...s, source: { ...s.source, kind: 'image' } }))
      }
      img.src = url
    },
    [renderer, setState],
  )

  const panel = (
    <Panel
      state={state}
      setState={setState}
      imageName={imageName}
      onFile={onFile}
      onPNG={(scale) => exportPNG(renderer, state, scale, timeRef.current, pointerRef.current)}
      onVideo={(seconds, height, onProgress) =>
        exportVideo(renderer, state, { seconds, height, fps: 30, t0: timeRef.current, pointer: pointerRef.current, onProgress })
      }
      onSVG={() => exportSVG(renderer, state, timeRef.current, pointerRef.current)}
      onShare={() => navigator.clipboard.writeText(shareUrl(state))}
    />
  )


  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-separator px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[15px] font-semibold tracking-tight">Ripplyn Ripple</h1>
          <span className="hidden font-mono text-[11px] text-muted sm:inline">разрез · сдвиг · волна</span>
        </div>
        <Tabs selectedKey={state.aspect} onSelectionChange={(k) => setState((s) => ({ ...s, aspect: k as Aspect }))} className="w-auto">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Соотношение сторон">
              {ASPECTS.map((a) => (
                <Tabs.Tab key={a} id={a} className="px-3 font-mono text-[12px]">
                  {a}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-muted tabular-nums md:inline" title="Кадров в секунду превью">
            {playing ? `${fps} fps` : 'пауза'}
          </span>
          <Button size="sm" variant="secondary" onPress={() => setState((s) => randomState(s))}>
            Randomize
          </Button>
          <Button size="sm" variant="primary" isIconOnly aria-label={playing ? 'Пауза' : 'Играть'} onPress={() => setPlaying((p) => !p)}>
            <PlayIcon playing={playing} />
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <section className="checker min-h-0 min-w-0 flex-1 p-4 md:p-6">
          <Preview
            state={state}
            playing={playing}
            renderer={renderer}
            timeRef={timeRef}
            pointerRef={pointerRef}
            onImpact={(x, y) => setState((s) => ({ ...s, core: { ...s.core, impactX: +x.toFixed(3), impactY: +y.toFixed(3) } }))}
            onFile={onFile}
            onFps={setFps}
          />
        </section>
        {!mobile && <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-separator bg-off">{panel}</aside>}
      </main>

      {mobile && (
        <>
          <div className="border-t border-separator p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <Button fullWidth variant="primary" onPress={() => setDrawerOpen(true)}>
              Настройки
            </Button>
          </div>
          <Drawer>
            <Drawer.Backdrop variant="transparent" isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
              <Drawer.Content placement="bottom">
                <Drawer.Dialog className="max-h-[58dvh]">
                  <Drawer.Handle />
                  <Drawer.Header>
                    <Drawer.Heading>Настройки</Drawer.Heading>
                  </Drawer.Header>
                  <Drawer.Body className="overflow-y-auto px-0">{panel}</Drawer.Body>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
        </>
      )}
    </div>
  )
}
