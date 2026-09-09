import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Application, Todo } from '@shared/types'
import { STATUS_HEX, statusLabel } from '@/lib/format'
import { isOverdue, isDueToday } from '@/lib/todo'

export function StatsStrip({ apps, todos }: { apps: Application[]; todos: Todo[] }) {
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
    const overdue = todos.filter(isOverdue).length
    const dueToday = todos.filter(isDueToday).length
    return { total: apps.length, thisWeek, live, toApply, byStatus, overdue, dueToday }
  }, [apps, todos])

  if (apps.length === 0) return null

  const due = stats.overdue + stats.dueToday

  return (
    <div className="flex flex-wrap items-stretch gap-2.5">
      <Tile label="Total" value={stats.total} accent="#ffffff" />
      {stats.toApply > 0 && <Tile label="To apply" value={stats.toApply} accent="#ddd6c6" />}
      <Tile label="Applied this week" value={stats.thisWeek} accent="#ffc900" />
      <Tile label="Live" value={stats.live} accent="#a8e10c" />
      {due > 0 && (
        <Tile
          label={stats.overdue > 0 ? 'To-do · overdue' : 'To-do · today'}
          value={due}
          accent={stats.overdue > 0 ? '#ff6b57' : '#ddd6c6'}
          to="/todos"
        />
      )}
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

function Tile({
  label,
  value,
  accent,
  to,
}: {
  label: string
  value: number
  accent: string
  to?: string
}) {
  const cls =
    'flex min-w-[92px] flex-col justify-center border-3 border-ink rounded px-3 py-2 shadow-hard-sm'
  const inner = (
    <>
      <span className="font-display text-2xl font-bold leading-none">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
    </>
  )
  return to ? (
    <Link to={to} className={`${cls} nb-focus hover:-translate-y-[1px]`} style={{ background: accent }}>
      {inner}
    </Link>
  ) : (
    <div className={cls} style={{ background: accent }}>
      {inner}
    </div>
  )
}
