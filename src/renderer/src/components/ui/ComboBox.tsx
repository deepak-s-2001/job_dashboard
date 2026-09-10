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
 * Free-type text field with an on-brand suggestion popover (replaces the
 * native <datalist>, which the browser draws in its own un-styleable panel).
 * Any typed value is kept — the list only suggests.
 */
export function ComboBox({
  value,
  onChange,
  onCommit,
  options,
  placeholder,
  size = 'md',
  ariaLabel,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onCommit?: (v: string) => void
  options: string[]
  placeholder?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)

  const matches = useMemo(() => {
    const raw = value.trim().toLowerCase()
    if (raw.length < 2) return options.slice(0, 8)
    const LIMIT = 50
    const tokens = raw.split(/[\s,]+/).filter(Boolean)
    const starts: string[] = []
    const contains: string[] = []
    for (const o of options) {
      const lo = o.toLowerCase()
      if (!tokens.every((t) => lo.includes(t))) continue
      if (lo.startsWith(tokens[0])) {
        if (starts.length < LIMIT) starts.push(o)
      } else if (contains.length < LIMIT) {
        contains.push(o)
      }
      if (starts.length >= LIMIT) break
    }
    return [...starts, ...contains].slice(0, LIMIT)
  }, [value, options])

  const place = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 6, left: r.left, width: r.width })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place, matches.length])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (
        !wrapRef.current?.contains(e.target as Node) &&
        !popRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
        onCommit?.(value)
      }
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, value, onCommit])

  useEffect(() => setActive(0), [value])

  function choose(v: string) {
    onChange(v)
    onCommit?.(v)
    setOpen(false)
    inputRef.current?.focus()
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      if (matches[active]) {
        e.preventDefault()
        choose(matches[active])
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => onCommit?.(value)}
        onKeyDown={onKey}
        className={cn(
          'w-full border-3 border-ink bg-surface rounded nb-focus placeholder:text-muted/90',
          size === 'sm' ? 'h-9 px-2.5 text-[14px]' : 'h-10 px-3 text-[15px]',
          className,
        )}
      />
      {open &&
        rect &&
        matches.length > 0 &&
        createPortal(
          <div
            ref={popRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              zIndex: 80,
            }}
            className="max-h-[45vh] overflow-y-auto nb-scroll border-3 border-ink bg-surface rounded shadow-hard-lg animate-pop-in"
          >
            {matches.map((o, i) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={o === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={cn(
                  'block w-full border-b-2 border-ink/15 px-3 py-1.5 text-left text-[14px] font-semibold last:border-b-0',
                  i === active ? 'bg-accent-yellow' : 'bg-surface',
                )}
              >
                {o}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
