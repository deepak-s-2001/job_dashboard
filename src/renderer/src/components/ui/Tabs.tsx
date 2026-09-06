import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const TabCtx = createContext<{ value: string; onChange: (v: string) => void } | null>(null)

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
  return (
    <TabCtx.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabCtx.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
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
      aria-selected={active}
      onClick={() => ctx.onChange(value)}
      className={cn(
        'nb-focus -mb-[3px] flex items-center gap-1.5 rounded-t border-3 border-b-0 px-3 py-1.5 text-[13px] font-bold',
        active
          ? 'border-ink bg-surface text-ink'
          : 'border-transparent bg-transparent text-muted hover:text-ink',
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-ink px-1 text-[10px]',
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
    <div role="tabpanel" className={cn('animate-pop-in', className)}>
      {children}
    </div>
  )
}
