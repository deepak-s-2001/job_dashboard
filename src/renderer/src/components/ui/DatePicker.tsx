import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * On-brand date / date-time fields. The native <input type="date"> pops a
 * browser-drawn calendar we can't style; these render our own neobrutalist
 * popover instead. `DateField` round-trips 'YYYY-MM-DD'; `DateTimeField`
 * round-trips an ISO string and edits in local time.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function parseYmd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

function monthCells(view: Date): (Date | null)[] {
  const y = view.getFullYear()
  const m = view.getMonth()
  const lead = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const fmtClock = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

// ---------------------------------------------------------------------------

interface BaseProps {
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  ariaLabel?: string
  placeholder?: string
}

export function DateField({
  value,
  onChange,
  ...base
}: BaseProps & { value: string | null; onChange: (v: string | null) => void }) {
  const selected = parseYmd(value)
  return (
    <Picker
      {...base}
      withTime={false}
      display={selected ? fmtDay(selected) : ''}
      selected={selected}
      onCommit={(d) => onChange(d ? ymd(d) : null)}
    />
  )
}

export function DateTimeField({
  value,
  onChange,
  ...base
}: BaseProps & { value: string | null; onChange: (v: string | null) => void }) {
  const d = value ? new Date(value) : null
  const selected = d && !Number.isNaN(d.getTime()) ? d : null
  return (
    <Picker
      {...base}
      withTime
      display={selected ? `${fmtDay(selected)} · ${fmtClock(selected)}` : ''}
      selected={selected}
      onCommit={(nd) => onChange(nd ? nd.toISOString() : null)}
    />
  )
}

// ---------------------------------------------------------------------------

function Picker({
  withTime,
  display,
  selected,
  onCommit,
  size = 'md',
  disabled,
  className,
  ariaLabel,
  placeholder = withTime ? 'Pick a date & time' : 'Pick a date',
}: BaseProps & {
  withTime: boolean
  display: string
  selected: Date | null
  onCommit: (d: Date | null) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)

  const [draft, setDraft] = useState<Date>(() => selected ?? roundedNow())
  const [view, setView] = useState<Date>(() => startOfMonth(selected ?? new Date()))

  useEffect(() => {
    if (open) {
      const base = selected ?? roundedNow()
      setDraft(base)
      setView(startOfMonth(base))
    }
  }, [open, selected])

  const place = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 6, left: r.left, width: r.width })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !popRef.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const cells = useMemo(() => monthCells(view), [view])
  const today = new Date()

  function pickDay(d: Date) {
    const next = new Date(d)
    if (withTime) {
      next.setHours(draft.getHours(), draft.getMinutes(), 0, 0)
      setDraft(next)
    } else {
      onCommit(next)
      setOpen(false)
    }
  }

  const h12 = ((draft.getHours() + 11) % 12) + 1
  const pm = draft.getHours() >= 12
  const ampm = pm ? 'PM' : 'AM'

  const setH12 = useCallback(
    (n: number, isPm: boolean) => {
      const clamped = Math.min(12, Math.max(1, n))
      const h24 = (clamped % 12) + (isPm ? 12 : 0)
      setDraft((d) => {
        const next = new Date(d)
        next.setHours(h24, next.getMinutes(), 0, 0)
        return next
      })
    },
    [],
  )
  const setMin = useCallback((n: number) => {
    const clamped = ((Math.round(n) % 60) + 60) % 60
    setDraft((d) => {
      const next = new Date(d)
      next.setMinutes(clamped, 0, 0)
      return next
    })
  }, [])
  const toggleAmpm = useCallback(() => {
    setDraft((d) => {
      const next = new Date(d)
      next.setHours((next.getHours() + 12) % 24, next.getMinutes(), 0, 0)
      return next
    })
  }, [])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'nb-focus flex w-full items-center justify-between gap-2 border-3 border-ink bg-surface rounded',
          size === 'sm' ? 'h-9 px-2.5 text-[14px]' : 'h-10 px-3 text-[15px]',
          'disabled:opacity-50',
          open && 'shadow-hard-sm -translate-y-[1px]',
          className,
        )}
      >
        <span className={cn('truncate', !display && 'text-muted')}>{display || placeholder}</span>
        <CalendarGlyph />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: rect.top, left: rect.left, zIndex: 80 }}
            className="w-[300px] border-3 border-ink bg-surface rounded shadow-hard-lg animate-pop-in"
          >
            {/* month header */}
            <div className="flex items-center justify-between border-b-3 border-ink px-2 py-1.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                className="nb-focus h-7 w-7 border-2 border-ink rounded bg-surface font-bold hover:bg-accent-yellow"
              >
                ‹
              </button>
              <span className="font-display text-[14px] font-bold">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                className="nb-focus h-7 w-7 border-2 border-ink rounded bg-surface font-bold hover:bg-accent-yellow"
              >
                ›
              </button>
            </div>

            {/* day grid */}
            <div className="grid grid-cols-7 gap-0.5 p-2">
              {DOW.map((d) => (
                <span
                  key={d}
                  className="pb-1 text-center text-[11px] font-bold uppercase text-muted"
                >
                  {d}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={i} />
                const isSel = !!selected && sameDay(d, withTime ? draft : selected)
                const isToday = sameDay(d, today)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickDay(d)}
                    className={cn(
                      'nb-focus h-8 rounded border-2 text-[13px] font-semibold',
                      isSel
                        ? 'border-ink bg-accent-pink text-ink'
                        : isToday
                          ? 'border-ink bg-surface'
                          : 'border-transparent bg-surface hover:border-ink hover:bg-accent-yellow',
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            {/* time row */}
            {withTime && (
              <div className="flex items-center justify-center gap-1.5 border-t-3 border-ink px-2 py-2.5">
                <TimeInput
                  label="hour"
                  value={h12}
                  min={1}
                  max={12}
                  onChange={(n) => setH12(n, pm)}
                />
                <span className="font-display text-[18px] font-bold">:</span>
                <TimeInput
                  label="minute"
                  value={draft.getMinutes()}
                  min={0}
                  max={59}
                  pad2
                  onChange={setMin}
                />
                <button
                  type="button"
                  aria-label="Toggle AM or PM"
                  onClick={toggleAmpm}
                  className="nb-focus ml-1 h-9 w-12 border-3 border-ink rounded bg-accent-blue text-[13px] font-bold hover:bg-accent-yellow"
                >
                  {ampm}
                </button>
              </div>
            )}

            {/* actions */}
            <div className="flex items-center justify-between border-t-3 border-ink px-2 py-1.5 text-[13px] font-bold">
              <button
                type="button"
                onClick={() => {
                  onCommit(null)
                  setOpen(false)
                }}
                className="nb-focus px-1.5 py-0.5 text-muted hover:text-accent-coral"
              >
                Clear
              </button>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const n = roundedNow()
                    if (withTime) {
                      setDraft(n)
                      setView(startOfMonth(n))
                    } else {
                      onCommit(n)
                      setOpen(false)
                    }
                  }}
                  className="nb-focus px-1.5 py-0.5 hover:text-accent-blue"
                >
                  {withTime ? 'Now' : 'Today'}
                </button>
                {withTime && (
                  <button
                    type="button"
                    onClick={() => {
                      onCommit(draft)
                      setOpen(false)
                    }}
                    className="nb-focus border-2 border-ink rounded bg-accent-lime px-2 py-0.5 hover:bg-accent-yellow"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function TimeInput({
  label,
  value,
  min,
  max,
  pad2,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  pad2?: boolean
  onChange: (n: number) => void
}) {
  const fmt = (n: number) => (pad2 ? pad(n) : String(n))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(fmt(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused])

  const commit = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
  }

  return (
    <input
      inputMode="numeric"
      aria-label={label}
      value={text}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 2)
        setText(v)
        commit(v)
      }}
      onBlur={() => {
        commit(text)
        setFocused(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          onChange(value >= max ? min : value + 1)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          onChange(value <= min ? max : value - 1)
        }
      }}
      className="nb-focus h-9 w-12 border-3 border-ink rounded bg-surface text-center font-mono text-[16px] font-bold"
    />
  )
}

function CalendarGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" className="flex-none" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="1" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  )
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function roundedNow() {
  const d = new Date()
  d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0)
  return d
}
