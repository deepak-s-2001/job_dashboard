import { useState } from 'react'
import { cn } from '@/lib/cn'

export function SkillGroup({
  title,
  skills,
  accent,
}: {
  title: string
  skills: string[]
  accent: string
}) {
  const [copied, setCopied] = useState(false)
  if (skills.length === 0) return null

  async function copyAll() {
    await navigator.clipboard.writeText(skills.join(', '))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h4 className="font-display text-sm font-bold uppercase tracking-wide">{title}</h4>
        <span className="border-2 border-ink px-1 text-[11px] font-bold" style={{ background: accent }}>
          {skills.length}
        </span>
        <button
          onClick={copyAll}
          className="ml-auto text-[11px] font-bold text-muted underline hover:text-ink"
        >
          {copied ? 'copied!' : 'copy all'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s, i) => (
          <span
            key={s + i}
            className={cn(
              'border-2 border-ink px-2 py-0.5 text-[13px] font-semibold',
              i < 5 ? '' : 'bg-surface',
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

export function InsightList({ items, emoji }: { items: string[]; emoji: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Nothing here yet — run Extract to fill this in.</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li
          key={i}
          className="flex gap-2.5 border-2 border-ink bg-ground px-3 py-2 text-[13px] leading-relaxed"
        >
          <span className="flex-none">{emoji}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}
