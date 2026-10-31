import { Label, ListBox, Select, Slider, Switch, TextArea } from '@heroui/react'
import type { Key, ReactNode } from 'react'
import { useId } from 'react'
import { COLOR_LABELS, COLOR_TOKENS, PALETTE, RAMP_IDS, RAMPS, rampLabel, type ColorToken, type RampId } from '../engine/palette'
import type { ParamDef, ParamValue } from '../engine/types'

export function SliderField(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const fmt = props.format ?? ((v: number) => String(+v.toFixed(3)))
  return (
    <Slider
      className="w-full"
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      value={props.value}
      onChange={(v) => typeof v === 'number' && props.onChange(v)}
    >
      <Label className="text-[13px]">{props.label}</Label>
      <Slider.Output className="font-mono text-[12px] tabular-nums">{fmt(props.value)}</Slider.Output>
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  )
}

export function SwitchField(props: { label: ReactNode; value: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <Switch isSelected={props.value} onChange={props.onChange} className={props.className} size="sm">
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <span className="text-[13px]">{props.label}</span>
      </Switch.Content>
    </Switch>
  )
}

export function SelectField<T extends string>(props: {
  label: string
  value: T
  options: { value: T; label: string; swatch?: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <Select className="w-full" value={props.value} onChange={(v: Key | null) => v != null && props.onChange(String(v) as T)}>
      <Label className="text-[13px]">{props.label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {props.options.map((o) => (
            <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
              <span className="flex items-center gap-2">
                {o.swatch}
                {o.label}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

export const Swatch = ({ c }: { c: ColorToken }) => (
  <span className="inline-block size-3.5 shrink-0 rounded-full border border-deep/15" style={{ background: PALETTE[c] }} />
)

export const RampSwatch = ({ id }: { id: RampId }) => (
  <span
    className="inline-block h-3.5 w-8 shrink-0 rounded-sm border border-deep/15"
    style={{ background: `linear-gradient(90deg, ${RAMPS[id].map((c) => PALETTE[c]).join(',')})` }}
  />
)

export const colorOptions = COLOR_TOKENS.map((c) => ({ value: c, label: COLOR_LABELS[c], swatch: <Swatch c={c} /> }))
export const rampOptions = RAMP_IDS.map((id) => ({ value: id, label: rampLabel(id), swatch: <RampSwatch id={id} /> }))

export function TextAreaField(props: { label: string; value: string; rows?: number; placeholder?: string; onChange: (v: string) => void; mono?: boolean }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px]">
        {props.label}
      </Label>
      <TextArea
        id={id}
        rows={props.rows ?? 4}
        value={props.value}
        placeholder={props.placeholder}
        spellCheck={false}
        onChange={(e) => props.onChange(e.target.value)}
        className={props.mono === false ? '' : 'font-mono text-[12px] leading-tight whitespace-pre'}
      />
    </div>
  )
}

/** Builds the right control from a ParamDef — this is what makes effect modules self-describing. */
export function ParamControl({ def, value, onChange }: { def: ParamDef; value: ParamValue; onChange: (v: ParamValue) => void }) {
  switch (def.type) {
    case 'range':
      return (
        <SliderField
          label={def.label}
          value={Number(value)}
          min={def.min}
          max={def.max}
          step={def.step}
          onChange={onChange}
          format={(v) => (def.pow2 ? String(2 ** v) : `${+v.toFixed(3)}${def.unit ? ' ' + def.unit : ''}`)}
        />
      )
    case 'switch':
      return <SwitchField label={def.label} value={Boolean(value)} onChange={onChange} />
    case 'select':
      return <SelectField label={def.label} value={String(value)} options={def.options} onChange={onChange} />
    case 'color':
      return <SelectField label={def.label} value={String(value) as ColorToken} options={colorOptions} onChange={onChange} />
    case 'ramp':
      return <SelectField label={def.label} value={String(value) as RampId} options={rampOptions} onChange={onChange} />
    case 'text':
      return <TextAreaField label={def.label} value={String(value)} rows={def.rows} placeholder={def.placeholder} onChange={onChange} />
  }
}
