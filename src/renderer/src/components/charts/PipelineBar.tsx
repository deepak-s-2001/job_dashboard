import type { Application } from '@shared/types'
import { APPLICATION_STATUSES } from '@shared/types'
import { STATUS_HEX, statusLabel } from '@/lib/format'

/** One stacked bar of the current pipeline by status. */
export function PipelineBar({ apps }: { apps: Application[] }) {
  const counts = APPLICATION_STATUSES.map((s) => ({
    status: s,
    n: apps.filter((a) => a.status === s).length,
  })).filter((c) => c.n > 0)
  const total = apps.length || 1

  return (
    <div className="border-3 border-ink bg-surface rounded p-4 shadow-hard-sm">
      <h3 className="mb-3 font-display text-base font-bold uppercase tracking-wide">Pipeline</h3>
      <div className="flex h-8 gap-[2px] border-2 border-ink bg-ground">
        {counts.map((c) => (
          <div
            key={c.status}
            title={`${statusLabel(c.status)} · ${c.n}`}
            style={{ width: `${(c.n / total) * 100}%`, background: STATUS_HEX[c.status] }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[12px] font-semibold">
        {counts.map((c) => (
          <li key={c.status} className="flex items-center gap-1.5">
            <span className="h-3 w-3 flex-none border-2 border-ink" style={{ background: STATUS_HEX[c.status] }} />
            {statusLabel(c.status)}
            <span className="ml-auto font-bold">{c.n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
