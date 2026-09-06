import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

export function IconButton({
  className,
  active,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        'nb-focus flex h-9 w-9 items-center justify-center border-3 border-ink rounded bg-surface transition-transform duration-100',
        'hover:-translate-y-[1px] hover:shadow-hard active:translate-y-[1px] active:shadow-none',
        active && 'bg-accent-yellow',
        'disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="my-4 border-t-2 border-dashed border-ink/30" />
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-0 flex-1 border-t-2 border-dashed border-ink/30" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <div className="h-0 flex-1 border-t-2 border-dashed border-ink/30" />
    </div>
  )
}

export function EmptyState({
  emoji,
  title,
  children,
  action,
}: {
  emoji: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center border-3 border-ink rounded bg-surface text-3xl shadow-hard">
        {emoji}
      </div>
      <h3 className="text-xl">{title}</h3>
      {children && <p className="text-sm text-muted">{children}</p>}
      {action}
    </div>
  )
}
