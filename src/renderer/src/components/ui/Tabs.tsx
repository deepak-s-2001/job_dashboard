import { createContext, useContext, useId, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface TabCtxValue {
  value: string
  onChange: (v: string) => void
  base: string
}
const TabCtx = createContext<TabCtxValue | null>(null)

export function Tabs({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  const base = useId()
  return (
    <TabCtx.Provider value={{ value, onChange, base }}>
      <div className={className}>{children}</div>
    </TabCtx.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    )
    const i = tabs.findIndex((t) => t === document.activeElement)
    if (i < 0) return
    e.preventDefault()
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? tabs.length - 1
          : e.key === 'ArrowRight'
            ? (i + 1) % tabs.length
            : (i - 1 + tabs.length) % tabs.length
    tabs[next]?.focus()
    tabs[next]?.click()
  }
  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'flex flex-wrap gap-1 border-b-3 border-ink bg-ground px-1.5 pt-1.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Tab({
  value,
  count,
  children,
}: {
  value: string
  count?: number
  children: ReactNode
}) {
  const ctx = useContext(TabCtx)!
  const active = ctx.value === value
  return (
    <button
      role="tab"
      id={`${ctx.base}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${ctx.base}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      onClick={() => ctx.onChange(value)}
      className={cn(
        'nb-focus -mb-[3px] flex items-center gap-1.5 rounded-t border-3 border-b-0 px-3 py-2 text-[13.5px] font-bold',
        active
          ? 'border-ink bg-surface text-ink'
          : 'border-transparent bg-transparent text-muted hover:text-ink',
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-ink px-1 text-[11px]',
            active ? 'bg-accent-yellow' : 'bg-ground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export function TabPanel({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const ctx = useContext(TabCtx)!
  if (ctx.value !== value) return null
  return (
    <div
      role="tabpanel"
      id={`${ctx.base}-panel-${value}`}
      aria-labelledby={`${ctx.base}-tab-${value}`}
      tabIndex={0}
      className={cn('nb-focus animate-pop-in', className)}
    >
      {children}
    </div>
  )
}
