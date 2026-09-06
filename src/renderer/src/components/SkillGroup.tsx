import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Highlighted, stripMarkers } from './Highlighted'

function useCopy() {
  const [copied, setCopied] = useState(false)
  return {
    copied,
    copy: async (text: string) => {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    },
  }
}

export function SkillGroup({
  title,
  skills,
  accent,
}: {
  title: string
  skills: string[]
  accent: string
}) {
  const { copied, copy } = useCopy()
  if (skills.length === 0) return null

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <h4 className="font-display text-base font-bold uppercase tracking-wide">{title}</h4>
        <span
          className="border-2 border-ink px-1.5 text-[12px] font-bold"
          style={{ background: accent }}
        >
          {skills.length}
        </span>
        <button
          onClick={() => copy(skills.join(', '))}
          className="ml-auto text-[13px] font-bold text-muted underline hover:text-ink"
        >
          {copied ? 'copied!' : 'copy all'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s, i) => (
          <span
            key={s + i}
            className={cn(
              'border-2 border-ink px-2.5 py-1 text-[14px] font-semibold',
              i >= 5 && 'bg-surface',
            )}
            style={i < 5 ? { background: accent } : undefined}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

export function InsightList({
  items,
  tone = 'yellow',
  accent = '#23a094',
}: {
  items: string[]
  tone?: 'yellow' | 'pink'
  accent?: string
}) {
  const { copied, copy } = useCopy()
  if (items.length === 0) {
    return <p className="text-[15px] text-muted">Nothing here yet — run Extract to fill this in.</p>
  }
  return (
    <div>
      <div className="mb-2.5 flex justify-end">
        <button
          onClick={() => copy(items.map(stripMarkers).map((t) => `• ${t}`).join('\n'))}
          className="text-[13px] font-bold text-muted underline hover:text-ink"
        >
          {copied ? 'copied!' : 'copy all'}
        </button>
      </div>
      <ul className="space-y-2.5">
        {items.map((t, i) => (
          <li
            key={i}
            className="border-3 border-ink border-l-[10px] bg-surface rounded p-3.5 text-[15px] leading-relaxed shadow-hard-sm"
            style={{ borderLeftColor: accent }}
          >
            <Highlighted text={t} tone={tone} />
          </li>
        ))}
      </ul>
    </div>
  )
}
