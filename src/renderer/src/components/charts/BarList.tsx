import type { SegmentRow } from '@/lib/metrics'
import { titleCase } from '@/lib/format'
import { CHART } from './primitives'

/** Horizontal "response rate by X" list. Bars scale to 100%. */
export function BarList({
  title,
  rows,
  labelOf = (k) => titleCase(k),
  empty,
}: {
  title: string
  rows: SegmentRow[]
  labelOf?: (key: string) => string
  empty?: string
}) {
  return (
    <div className="border-3 border-ink bg-surface rounded p-4 shadow-hard-sm">
      <h3 className="mb-3 font-display text-base font-bold uppercase tracking-wide">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">{empty ?? 'Nothing to show yet.'}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} title={`${r.responded}/${r.applied} responded · ${r.interviewed} interviewed`}>
              <div className="mb-0.5 flex items-baseline justify-between text-[12px] font-bold">
                <span className="truncate">{labelOf(r.key)}</span>
                <span>
                  {r.responseRate}% <span className="font-normal text-muted">({r.responded}/{r.applied})</span>
                </span>
              </div>
              <div className="h-4 border-2 border-ink bg-ground">
                <div
                  className="h-full border-r-2 border-ink"
                  style={{ width: `${Math.max(1, r.responseRate)}%`, background: CHART.bar }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
