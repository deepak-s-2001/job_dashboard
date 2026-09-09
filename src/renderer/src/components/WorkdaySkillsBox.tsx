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
 * "Paste into Workday" — Workday's skill field is a taxonomy typeahead. Its
 * search box merges ANY pasted text (commas *or* newlines) into a single skill,
 * so there is no bulk paste. The only thing that works is one skill at a time:
 * copy → paste → pick the dropdown match → repeat. This drives that loop with a
 * "Copy next" button + progress, and keeps a plain newline list as a fallback
 * for other ATSs (Greenhouse/Lever/Ashby) whose fields *do* split on newlines.
 */
export function WorkdaySkillsBox({ skills }: { skills: ApplicationSkills }) {
  const master = useMemo(() => masterList(skills), [skills])
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<Set<string>>(new Set())
  const [justCopied, setJustCopied] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [text, setText] = useState('')
  const list = useCopy()

  const included = useMemo(() => master.filter((s) => !removed.has(key(s))), [master, removed])
  const removedList = useMemo(() => master.filter((s) => removed.has(key(s))), [master, removed])
  const next = included.find((s) => !done.has(key(s))) ?? null

  const seed = included.join('\n')
  useEffect(() => setText(seed), [seed])

  if (master.length === 0) return null

  function toggleRemoved(s: string) {
    setRemoved((prev) => {
      const n = new Set(prev)
      if (n.has(key(s))) n.delete(key(s))
      else n.add(key(s))
      return n
    })
  }

  async function markCopied(s: string) {
    await navigator.clipboard.writeText(s).catch(() => {})
    setDone((prev) => new Set(prev).add(key(s)))
    setJustCopied(s)
    setTimeout(() => setJustCopied((j) => (j === s ? null : j)), 1400)
  }

  const total = included.length
  const doneCount = included.filter((s) => done.has(key(s))).length

  return (
    <div className="border-3 border-ink bg-ground rounded p-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h4 className="font-display text-base font-bold uppercase tracking-wide">
          Paste into Workday
        </h4>
        <span className="border-2 border-ink bg-surface px-1.5 text-[12px] font-bold">
          {doneCount} / {total} added
        </span>
        {doneCount > 0 && (
          <button
            onClick={() => setDone(new Set())}
            className="text-[12px] font-bold text-muted underline hover:text-ink"
          >
            reset
          </button>
        )}
      </div>

      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        Workday merges any pasted list into one skill — commas or line breaks. Add them{' '}
        <strong className="text-ink">one at a time</strong>: hit <em>Copy next</em>, paste into
        Workday's skill box, pick the match from its dropdown, repeat.
      </p>

      {next ? (
        <Button variant="primary" onClick={() => markCopied(next)}>
          {justCopied ? `✓ copied "${justCopied}"` : 'Copy next'}
          {!justCopied && <span className="ml-1.5 font-normal opacity-90">— {next}</span>}
        </Button>
      ) : (
        <div className="border-2 border-ink bg-accent-lime px-3 py-1.5 text-[13px] font-bold">
          All {total} skills copied ✓
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {included.map((s) => {
          const isDone = done.has(key(s))
          return (
            <span
              key={s}
              className={cn(
                'inline-flex items-center border-2 border-ink text-[13px] font-semibold',
                isDone ? 'bg-accent-lime text-ink/60' : 'bg-surface',
              )}
            >
              <button
                type="button"
                onClick={() => markCopied(s)}
                title="Copy this skill"
                className="nb-focus px-2 py-1"
              >
                {isDone ? `${s} ✓` : s}
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
          )
        })}
      </div>

      {removedList.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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

      <button
        onClick={() => setShowList((v) => !v)}
        className="mt-3 text-[12px] font-bold text-muted underline hover:text-ink"
      >
        {showList ? 'hide' : 'show'} plain list — for Greenhouse / Lever / Ashby
      </button>
      {showList && (
        <div className="mt-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.min(Math.max(included.length, 3) + 1, 14)}
            spellCheck={false}
            className="font-mono text-[13px]"
            aria-label="Skills, one per line"
          />
          <Button className="mt-2" onClick={() => list.copy(text)}>
            {list.copied ? 'Copied ✓' : 'Copy list (one per line)'}
          </Button>
          <p className="mt-1 text-[12px] text-muted">
            Those ATS skill boxes split on line breaks. Workday does not.
          </p>
        </div>
      )}
    </div>
  )
}
