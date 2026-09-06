import { useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag…',
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  function add(tag: string) {
    const t = tag.trim()
    if (!t) return
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t])
    setDraft('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const remaining = suggestions
    .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    .filter((s) => !draft || s.toLowerCase().includes(draft.toLowerCase()))
    .slice(0, 6)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-3 border-ink bg-surface rounded p-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 border-2 border-ink bg-accent-lime px-1.5 py-0.5 text-[12px] font-semibold"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="text-ink/60 hover:text-ink"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[8ch] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn(
                'border-2 border-ink border-dashed px-1.5 py-0.5 text-[12px] font-medium text-muted',
                'hover:border-solid hover:bg-accent-lime hover:text-ink',
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
