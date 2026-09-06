import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Chip({
  className,
  color,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border-2 border-ink px-2 py-0.5 text-[12px] font-semibold leading-tight',
        className,
      )}
      style={color ? { background: color } : undefined}
      {...rest}
    >
      {children}
    </span>
  )
}

export function Badge({
  className,
  color,
  children,
}: {
  className?: string
  color?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        className,
      )}
      style={color ? { background: color } : undefined}
    >
      {color && (
        <span className="h-1.5 w-1.5 rounded-full border border-ink bg-ink/70" aria-hidden />
      )}
      {children}
    </span>
  )
}

export function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink"
      style={{ background: color }}
      aria-hidden
    />
  )
}
