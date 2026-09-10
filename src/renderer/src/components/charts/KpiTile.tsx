import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Sparkline } from './Sparkline'

export function KpiTile({
  label,
  value,
  suffix,
  delta,
  spark,
  accent = '#ffffff',
  to,
  hint,
}: {
  label: string
  value: ReactNode
  suffix?: string
  delta?: string
  spark?: number[]
  accent?: string
  to?: string
  hint?: string
}) {
  const body = (
    <>
      <div className="flex items-end gap-1.5">
        <span className="font-display text-[28px] font-bold leading-none">{value}</span>
        {suffix && <span className="text-[13px] font-bold text-muted">{suffix}</span>}
        {delta && delta !== '—' && (
          <span
            className={cn(
              'ml-auto border-2 border-ink px-1 text-[11px] font-bold',
              delta.startsWith('▲') ? 'bg-accent-lime' : 'bg-accent-coral',
            )}
          >
            {delta}
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
      {spark && spark.length > 1 && (
        <div className="mt-1.5">
          <Sparkline data={spark} />
        </div>
      )}
    </>
  )
  const cls =
    'block border-3 border-ink rounded p-3 shadow-hard-sm min-w-[120px] flex-1'
  return to ? (
    <Link to={to} className={cn(cls, 'nb-focus hover:-translate-y-[1px]')} style={{ background: accent }}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={{ background: accent }}>
      {body}
    </div>
  )
}
