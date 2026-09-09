import { useEffect, useMemo, useState } from 'react'
import type { ApplicationSkills } from '@shared/types'
import { stripMarkers } from './Highlighted'
import { Textarea } from './ui/Field'
import { Button } from './ui/Button'
import { useCopy } from '@/lib/useCopy'
import { cn } from '@/lib/cn'

const key = (s: string) => s.trim().toLowerCase()

/** required → preferred → industry, markers stripped, case-insensitive dedupe. */
function masterList(skills: ApplicationSkills): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [...skills.required, ...skills.preferred, ...skills.industry]) {
    const clean = stripMarkers(s).trim()
    if (!clean || seen.has(key(clean))) continue
    seen.add(key(clean))
    out.push(clean)
  }
  return out
}

/**
 * "Paste into Workday" — Workday's skill field is a taxonomy typeahead whose
 * search box takes a pasted comma list as ONE skill. This turns the extracted
 * skills into a newline-delimited block (which the tenants that choke on commas
 * do split), plus a click-to-copy-one mode with progress tracking for tenants
 * where every skill must be picked from the dropdown by hand.
 */
export function WorkdaySkillsBox({ skills }: { skills: ApplicationSkills }) {
  const master = useMemo(() => masterList(skills), [skills])
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')
  const { copied, copy } = useCopy()
  const [flash, setFlash] = useState<string | null>(null)

  const included = useMemo(
    () => master.filter((s) => !removed.has(key(s))),
    [master, removed],
  )
  const removedList = useMemo(
    () => master.filter((s) => removed.has(key(s))),
    [master, removed],
  )

  // re-seed the editable box whenever the chip set changes
  const seed = included.join('\n')
  useEffect(() => setText(seed), [seed])

  if (master.length === 0) return null

  function toggleRemoved(s: string) {
    setRemoved((prev) => {
      const next = new Set(prev)
      if (next.has(key(s))) next.delete(key(s))
      else next.add(key(s))
      return next
    })
  }

  async function copyOne(s: string) {
    await navigator.clipboard.writeText(s).catch(() => {})
    setDone((prev) => new Set(prev).add(key(s)))
    setFlash(key(s))
    setTimeout(() => setFlash((f) => (f === key(s) ? null : f)), 1000)
  }

  const count = included.length
  const hint =
    count < 8 ? 'Workday works best with 8–15' : count > 15 ? `${count} is a lot — Workday suggests 8–15` : null

  return (
    <div className="border-3 border-ink bg-ground rounded p-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h4 className="font-display text-base font-bold uppercase tracking-wide">
          Paste into Workday
        </h4>
        <span className="border-2 border-ink bg-surface px-1.5 text-[12px] font-bold">
          {count} skill{count === 1 ? '' : 's'}
        </span>
        {hint && <span className="text-[12px] font-semibold text-muted">{hint}</span>}
        {done.size > 0 && (
          <span className="ml-auto text-[12px] font-bold text-muted">
            {done.size} / {count} copied ·{' '}
            <button onClick={() => setDone(new Set())} className="underline hover:text-ink">
              reset
            </button>
          </span>
        )}
      </div>

      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        Workday's skill box doesn't split on commas. Paste this block, or click a skill to copy
        it on its own and pick it from Workday's dropdown.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {included.map((s) => (
          <span
            key={s}
            className={cn(
              'group inline-flex items-center border-2 border-ink text-[13px] font-semibold',
              done.has(key(s)) ? 'bg-accent-lime' : 'bg-surface',
            )}
          >
            <button
              type="button"
              onClick={() => copyOne(s)}
              title="Copy just this skill"
              className="nb-focus px-2 py-1"
            >
              {flash === key(s) ? 'copied ✓' : done.has(key(s)) ? `${s} ✓` : s}
            </button>
            <button
              type="button"
              onClick={() => toggleRemoved(s)}
              aria-label={`Remove ${s}`}
              className="nb-focus border-l-2 border-ink px-1.5 py-1 text-ink/60 hover:bg-accent-coral hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {removedList.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-wide text-muted">off:</span>
          {removedList.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleRemoved(s)}
              className="border-2 border-dashed border-ink px-1.5 py-0.5 text-[12px] font-medium text-muted hover:border-solid hover:bg-accent-lime hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(Math.max(included.length, 3) + 1, 14)}
        spellCheck={false}
        className="font-mono text-[13px]"
        aria-label="Skills, one per line"
      />

      <div className="mt-2.5">
        <Button variant="primary" onClick={() => copy(text)}>
          {copied ? 'Copied ✓' : 'Copy all — one per line'}
        </Button>
      </div>
    </div>
  )
}
