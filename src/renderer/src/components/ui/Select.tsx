import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
  title?: string
  align?: 'left' | 'right'
}

const CHEVRON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  size = 'md',
  title,
  align = 'left',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)

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
    const onScroll = () => setOpen(false)
    const onResize = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !popRef.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)))
  }, [open, options, value])

  function choose(v: string) {
    onChange(v)
    setOpen(false)
    btnRef.current?.focus()
  }

  function onKey(e: React.KeyboardEvent) {
    if (disabled) return
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = options[active]
      if (opt) choose(opt.value)
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKey}
        className={cn(
          'nb-focus flex w-full items-center justify-between gap-2 border-3 border-ink bg-surface rounded font-semibold',
          size === 'sm' ? 'h-9 px-2.5 text-[14px]' : 'h-10 px-3 text-[15px]',
          'disabled:opacity-50',
          !disabled &&
            'hover:-translate-y-[1px] hover:shadow-hard-sm transition-transform duration-100',
          open && 'shadow-hard-sm -translate-y-[1px]',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted')}>
          {selected?.label ?? placeholder}
        </span>
        <span className={cn('flex-none transition-transform', open && 'rotate-180')}>
          {CHEVRON}
        </span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            role="listbox"
            id={listId}
            style={{
              position: 'fixed',
              top: rect.top,
              left: align === 'right' ? undefined : rect.left,
              right: align === 'right' ? window.innerWidth - rect.left - rect.width : undefined,
              minWidth: rect.width,
              zIndex: 80,
            }}
            className="max-h-[50vh] overflow-y-auto nb-scroll border-3 border-ink bg-surface rounded shadow-hard-lg animate-pop-in"
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={cn(
                  'flex w-full items-center gap-2 border-b-2 border-ink/10 px-3 py-2 text-left text-[14px] font-semibold last:border-b-0',
                  i === active ? 'bg-accent-yellow' : 'bg-surface',
                  o.value === value && i !== active && 'bg-accent-yellow/40',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 flex-none items-center justify-center border-2 border-ink text-[10px]',
                    o.value === value ? 'bg-ink text-ground' : 'bg-surface',
                  )}
                >
                  {o.value === value ? '✓' : ''}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
