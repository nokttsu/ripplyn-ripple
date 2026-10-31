import { Accordion, Button, ProgressBar } from '@heroui/react'
import { useRef, useState } from 'react'
import { EFFECTS } from '../engine/effects'
import { exportSize, svgBlockers, videoMime } from '../engine/export'
import { stripCount } from '../engine/ripple'
import { PRESETS } from '../engine/state'
import type { AppState, CoreParams, ParamValue, SourceKind, SourceState } from '../engine/types'
import { colorOptions, ParamControl, rampOptions, SelectField, SliderField, SwitchField, TextAreaField } from './controls'

export interface PanelProps {
  state: AppState
  setState: (fn: (s: AppState) => AppState) => void
  imageName: string | null
  onFile: (f: File) => void
  onPNG: (scale: number) => Promise<void>
  onVideo: (seconds: number, height: number, onProgress: (p: number) => void) => Promise<void>
  onSVG: () => void
  onShare: () => Promise<void>
}

const SOURCE_KINDS: { value: SourceKind; label: string }[] = [
  { value: 'generated', label: 'Сгенерированный' },
  { value: 'image', label: 'Картинка' },
  { value: 'ascii', label: 'ASCII-текст' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Accordion.Item id={id}>
      <Accordion.Heading>
        <Accordion.Trigger className="text-[13px] font-semibold uppercase tracking-wider">
          {title}
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="flex flex-col gap-5 pb-5">{children}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

export function Panel({ state, setState, imageName, onFile, onPNG, onVideo, onSVG, onShare }: PanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [scale, setScale] = useState('2')
  const [seconds, setSeconds] = useState(5)
  const [vh, setVh] = useState('1080')
  const [busy, setBusy] = useState<null | 'png' | 'video'>(null)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSource = (patch: Partial<SourceState>) => setState((s) => ({ ...s, source: { ...s.source, ...patch } }))
  const setCore = (patch: Partial<CoreParams>) => setState((s) => ({ ...s, core: { ...s.core, ...patch } }))
  const setEffect = (id: string, patch: { enabled?: boolean; key?: string; value?: ParamValue }) =>
    setState((s) => {
      const es = s.effects[id]
      const params = patch.key ? { ...es.params, [patch.key]: patch.value! } : es.params
      return { ...s, effects: { ...s.effects, [id]: { enabled: patch.enabled ?? es.enabled, params } } }
    })

  const blockers = svgBlockers(state)
  const size = exportSize(state.aspect, Number(scale))
  const mime = videoMime()
  const run = async (kind: 'png' | 'video', fn: () => Promise<void>) => {
    setError(null)
    setBusy(kind)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
      setProgress(0)
    }
  }

  return (
    <div className="flex flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />

      <div className="flex flex-col gap-2 border-b border-separator px-4 pt-4 pb-4">
        <div className="text-[13px] font-semibold uppercase tracking-wider">Пресеты</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="tertiary"
              onPress={() =>
                setState((s) => {
                  const next = p.build()
                  next.aspect = s.aspect
                  // keep an uploaded picture as the source
                  if (s.source.kind === 'image') next.source.kind = 'image'
                  return next
                })
              }
            >
              {p.name}
            </Button>
          ))}
        </div>
      </div>

      <Accordion allowsMultipleExpanded defaultExpandedKeys={['source', 'wave', 'effects']} className="px-4">
        <Section id="source" title="Исходник">
          <SelectField label="Тип исходника" value={state.source.kind} options={SOURCE_KINDS} onChange={(kind) => setSource({ kind })} />
          {state.source.kind === 'generated' && (
            <>
              <SelectField label="Градиент" value={state.source.ramp} options={rampOptions} onChange={(ramp) => setSource({ ramp })} />
              <SliderField label="Пятна" value={state.source.spots} min={0} max={14} step={1} onChange={(spots) => setSource({ spots })} />
              <SwitchField label="Линия горизонта" value={state.source.horizon} onChange={(horizon) => setSource({ horizon })} />
              <Button size="sm" variant="secondary" onPress={() => setSource({ seed: Math.floor(Math.random() * 1e6) })}>
                Перемешать пятна
              </Button>
            </>
          )}
          {state.source.kind === 'image' && (
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="secondary" onPress={() => fileRef.current?.click()}>
                {imageName ? 'Заменить картинку' : 'Загрузить картинку'}
              </Button>
              <p className="text-[12px] text-muted">
                {imageName ? `Загружено: ${imageName}` : 'Или перетащите файл на канвас.'} Картинка не попадает в ссылку для шаринга.
              </p>
            </div>
          )}
          {state.source.kind === 'ascii' && (
            <>
              <TextAreaField label="ASCII-арт" rows={8} value={state.source.asciiText} onChange={(asciiText) => setSource({ asciiText })} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Символы" value={state.source.asciiFg} options={colorOptions} onChange={(asciiFg) => setSource({ asciiFg })} />
                <SelectField label="Фон" value={state.source.asciiBg} options={colorOptions} onChange={(asciiBg) => setSource({ asciiBg })} />
              </div>
            </>
          )}
        </Section>

        <Section id="wave" title="Нарезка и волна">
          <SliderField
            label="Полос"
            value={state.core.stripsExp}
            min={1}
            max={9}
            step={1}
            format={(v) => String(stripCount(v))}
            onChange={(stripsExp) => setCore({ stripsExp })}
          />
          <SliderField label="Амплитуда" value={state.core.amp} min={0} max={0.4} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(amp) => setCore({ amp })} />
          <SliderField label="Частота" value={state.core.freq} min={0.25} max={10} step={0.05} onChange={(freq) => setCore({ freq })} />
          <SliderField label="Скорость" value={state.core.speed} min={0} max={4} step={0.05} onChange={(speed) => setCore({ speed })} />
          <SliderField label="Точка удара, X" value={state.core.impactX} min={0} max={1} step={0.01} onChange={(impactX) => setCore({ impactX })} />
          <p className="-mt-2 text-[12px] text-muted">Клик по канвасу переставляет точку удара.</p>
        </Section>

        <Section id="effects" title="Эффекты">
          {EFFECTS.map((e) => {
            const es = state.effects[e.id]
            return (
              <div key={e.id} className="flex flex-col gap-4 border-b border-separator pb-4 last:border-0 last:pb-0">
                <div className="flex flex-col gap-1">
                  <SwitchField label={<span className="font-medium">{e.name}</span>} value={es.enabled} onChange={(enabled) => setEffect(e.id, { enabled })} />
                  {e.description && <p className="text-[12px] leading-snug text-muted">{e.description}</p>}
                </div>
                {es.enabled &&
                  e.params.map((d) => (
                    <ParamControl key={d.key} def={d} value={es.params[d.key]} onChange={(value) => setEffect(e.id, { key: d.key, value })} />
                  ))}
              </div>
            )
          })}
        </Section>

        <Section id="export" title="Экспорт">
          <div className="flex flex-col gap-2">
            <SelectField
              label="PNG, размер"
              value={scale}
              options={[
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '4', label: '4x' },
              ]}
              onChange={setScale}
            />
            <p className="text-[12px] text-muted">
              {size.w} × {size.h} px{size.clamped ? ' (ограничено лимитом canvas в Safari)' : ''}
            </p>
            <Button variant="primary" isPending={busy === 'png'} isDisabled={!!busy} onPress={() => run('png', () => onPNG(Number(scale)))}>
              Скачать PNG
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            <SliderField label="Видео, длительность" value={seconds} min={3} max={10} step={1} format={(v) => `${v} с`} onChange={setSeconds} />
            <SelectField
              label="Видео, высота"
              value={vh}
              options={[
                { value: '720', label: '720p' },
                { value: '1080', label: '1080p' },
              ]}
              onChange={setVh}
            />
            {busy === 'video' && <ProgressBar aria-label="Запись видео" value={progress * 100} />}
            <Button
              variant="primary"
              isDisabled={!!busy || !mime}
              isPending={busy === 'video'}
              onPress={() => run('video', () => onVideo(seconds, Number(vh), setProgress))}
            >
              {mime?.includes('mp4') ? 'Записать видео (MP4)' : 'Записать WebM'}
            </Button>
            {!mime && <p className="text-[12px] text-muted">MediaRecorder недоступен в этом браузере.</p>}
            {mime?.includes('mp4') && <p className="text-[12px] text-muted">Браузер не умеет WebM, запись пойдёт в MP4.</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="secondary" isDisabled={blockers.length > 0} onPress={onSVG}>
              Скачать SVG
            </Button>
            <p className="text-[12px] text-muted">
              {blockers.length ? `SVG недоступен с растровыми эффектами: ${blockers.join(', ')}.` : 'Полосы как <rect> с градиентом, снятым с исходника.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              onPress={async () => {
                await onShare()
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              }}
            >
              {copied ? 'Ссылка скопирована' : 'Скопировать ссылку на результат'}
            </Button>
            <p className="text-[12px] text-muted">Все настройки сохраняются в адресе страницы.</p>
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </Section>
      </Accordion>
    </div>
  )
}
