import { APPLICATION_STATUSES, type ApplicationStatus } from '@shared/types'
import { STATUS_HEX, titleCase } from '@/lib/format'
import { cn } from '@/lib/cn'

export function StatusControl({
  value,
  onChange,
  size = 'md',
}: {
  value: ApplicationStatus
  onChange: (s: ApplicationStatus) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {APPLICATION_STATUSES.map((s) => {
        const active = s === value
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              'nb-focus border-2 border-ink font-bold uppercase tracking-wide transition-transform',
              size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
              active
                ? 'shadow-hard-sm -translate-y-[1px]'
                : 'bg-surface text-muted hover:text-ink',
            )}
            style={active ? { background: STATUS_HEX[s] } : undefined}
          >
            {titleCase(s)}
          </button>
        )
      })}
    </div>
  )
}

export function StatusPill({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: STATUS_HEX[status] }}
    >
      {titleCase(status)}
    </span>
  )
}
