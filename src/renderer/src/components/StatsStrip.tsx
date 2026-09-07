import { useMemo } from 'react'
import type { Application } from '@shared/types'
import { STATUS_HEX, statusLabel } from '@/lib/format'

export function StatsStrip({ apps }: { apps: Application[] }) {
  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10)
    const byStatus: Record<string, number> = {}
    let thisWeek = 0
    let live = 0
    let toApply = 0
    for (const a of apps) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
      if (a.status === 'not-applied') toApply++
      else if (a.dateApplied >= weekAgo) thisWeek++
      if (a.status === 'applied' || a.status === 'interviewing') live++
    }
    return { total: apps.length, thisWeek, live, toApply, byStatus }
  }, [apps])

  if (apps.length === 0) return null

  return (
    <div className="flex flex-wrap items-stretch gap-2.5">
      <Tile label="Total" value={stats.total} accent="#ffffff" />
      {stats.toApply > 0 && <Tile label="To apply" value={stats.toApply} accent="#ddd6c6" />}
      <Tile label="Applied this week" value={stats.thisWeek} accent="#ffc900" />
      <Tile label="Live" value={stats.live} accent="#a8e10c" />
      <div className="flex flex-1 flex-wrap items-center gap-1.5 border-3 border-ink bg-surface rounded px-3 py-2">
        {Object.entries(stats.byStatus)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold"
              style={{ background: STATUS_HEX[s] }}
            >
              {statusLabel(s)} <span className="rounded bg-ink/15 px-1">{n}</span>
            </span>
          ))}
      </div>
    </div>
  )
}

function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div
      className="flex min-w-[92px] flex-col justify-center border-3 border-ink rounded px-3 py-2 shadow-hard-sm"
      style={{ background: accent }}
    >
      <span className="font-display text-2xl font-bold leading-none">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
    </div>
  )
}
