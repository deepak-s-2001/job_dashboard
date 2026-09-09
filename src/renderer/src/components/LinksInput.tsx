import type { ContactLink } from '@shared/types'
import { Input } from './ui/Field'

const PRESETS = ['LinkedIn', 'X / Twitter', 'GitHub', 'Website', 'Instagram', 'Other']

export function LinksInput({
  value,
  onChange,
}: {
  value: ContactLink[]
  onChange: (links: ContactLink[]) => void
}) {
  const set = (i: number, patch: Partial<ContactLink>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const add = () => onChange([...value, { label: '', url: '' }])

  return (
    <div className="space-y-2">
      {value.map((link, i) => (
        <div key={i} className="flex gap-2">
          <input
            list="link-presets"
            value={link.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="Label"
            className="h-10 w-32 flex-none border-3 border-ink bg-surface rounded px-2 text-[14px] nb-focus placeholder:text-muted/90"
          />
          <Input
            value={link.url}
            onChange={(e) => set(i, { url: e.target.value })}
            placeholder="https://…"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove link"
            className="nb-focus h-10 w-10 flex-none border-3 border-ink bg-surface text-lg font-bold hover:bg-accent-coral"
          >
            ×
          </button>
        </div>
      ))}
      <datalist id="link-presets">
        {PRESETS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={add}
        className="nb-focus border-2 border-dashed border-ink px-2.5 py-1 text-[13px] font-bold hover:border-solid hover:bg-accent-lime"
      >
        + add link
      </button>
    </div>
  )
}
