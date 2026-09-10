import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '@/lib/store'
import {
  computeKpis,
  funnel,
  weeklySeries,
  bySegment,
  weekDelta,
  needsAttention,
  deltaArrow,
  upcoming,
  offerTimingNudge,
} from '@/lib/metrics'
import { groupTodos } from '@/lib/todo'
import { SOURCE_LABEL, initials, fmtDateTime, relDays } from '@/lib/format'
import { KpiTile } from '@/components/charts/KpiTile'
import { TrendChart } from '@/components/charts/TrendChart'
import { Funnel } from '@/components/charts/Funnel'
import { BarList } from '@/components/charts/BarList'
import { PipelineBar } from '@/components/charts/PipelineBar'
import { QuickAddTodo } from '@/components/QuickAddTodo'
import { TodoRow } from '@/components/TodoRow'
import { Select } from '@/components/ui/Select'
import { EmptyState, Spinner } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'

const RANGES = [
  { value: '8', label: 'Last 8 weeks' },
  { value: '12', label: 'Last 12 weeks' },
  { value: '26', label: 'Last 26 weeks' },
  { value: '999', label: 'All time' },
]

export function Overview() {
  const { apps, todos, createTodo, archiveApps, loading, error } = useAppData()
  const [weeks, setWeeks] = useState('12')

  const kpis = useMemo(() => computeKpis(apps), [apps])
  const stages = useMemo(() => funnel(apps), [apps])
  const series = useMemo(() => weeklySeries(apps, Number(weeks)), [apps, weeks])
  const spark = useMemo(() => weeklySeries(apps, 8).map((w) => w.applied), [apps])
  const bySource = useMemo(() => bySegment(apps, (a) => [a.sourceSite]), [apps])
  const byTag = useMemo(() => bySegment(apps, (a) => a.tags), [apps])
  const delta = useMemo(() => weekDelta(apps), [apps])
  const attention = useMemo(() => needsAttention(apps, todos), [apps, todos])
  const up = useMemo(() => upcoming(apps), [apps])
  const nudge = useMemo(() => offerTimingNudge(apps), [apps])

  const dueTodos = useMemo(() => {
    const g = groupTodos(todos)
    return g
      .filter((x) => x.key === 'overdue' || x.key === 'today' || x.key === 'week')
      .flatMap((x) => x.items)
  }, [todos])

  if (loading && apps.length === 0) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted">
        <Spinner /> Loading…
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto nb-scroll">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b-3 border-ink bg-ground/95 px-6 py-4 backdrop-blur">
        <h1 className="font-display text-2xl font-bold">Overview</h1>
        <div className="ml-auto">
          <Select value={weeks} onChange={setWeeks} options={RANGES} ariaLabel="Chart time range" align="right" />
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] space-y-5 p-6">
        {error && (
          <div className="border-3 border-ink bg-accent-coral p-3 text-sm font-semibold">{error}</div>
        )}

        {apps.length === 0 ? (
          <EmptyState
            emoji="📊"
            title="No metrics yet"
            action={
              <div className="flex gap-2">
                <Link to="/add">
                  <Button variant="primary" size="lg">
                    Add an application
                  </Button>
                </Link>
                <Link to="/import">
                  <Button size="lg">Import a list</Button>
                </Link>
              </div>
            }
          >
            Add or import your applications and this page fills with charts — a funnel, weekly
            trend, response rates, and what needs a follow-up.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap gap-2.5">
              <KpiTile label="Applications" value={kpis.total} spark={spark} to="/applications" />
              <KpiTile label="Active pipeline" value={kpis.active} accent="#a8e10c" hint="applied + interviewing" />
              <KpiTile label="Response rate" value={kpis.responseRate} suffix="%" accent="#23a094" hint={`${kpis.responded}/${kpis.applied} applied`} />
              <KpiTile label="Interview rate" value={kpis.interviewRate} suffix="%" accent="#ffc900" hint={kpis.appsPerInterview ? `~${kpis.appsPerInterview} apps / interview` : undefined} />
              <KpiTile label="Offers" value={kpis.offered} accent="#22c55e" />
              <KpiTile label="Applied this week" value={delta.applied.now} delta={deltaArrow(delta.applied.now, delta.applied.prev)} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
              <TrendChart data={series} />
              <Funnel stages={stages} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <BarList
                title="Response rate by source"
                rows={bySource}
                labelOf={(k) => SOURCE_LABEL[k] ?? k}
                empty="No applied jobs yet."
              />
              {byTag.length > 0 ? (
                <BarList title="Response rate by tag" rows={byTag} labelOf={(k) => `#${k}`} />
              ) : (
                <PipelineBar apps={apps} />
              )}
            </div>

            {(up.length > 0 || nudge) && (
              <div className="border-3 border-ink bg-surface rounded p-4 shadow-hard-sm">
                <h3 className="mb-3 font-display text-base font-bold uppercase tracking-wide">
                  Upcoming
                </h3>
                {nudge && (
                  <p className="mb-3 border-l-4 border-ink bg-accent-yellow/40 px-3 py-2 text-[13px] font-semibold">
                    {nudge}
                  </p>
                )}
                {up.length === 0 ? (
                  <p className="text-[13px] text-muted">No interviews or deadlines scheduled.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {up.slice(0, 10).map((it, i) => (
                      <li key={i}>
                        <Link
                          to={`/app/${it.app.id}`}
                          className="flex items-center gap-2.5 border-2 border-ink bg-ground px-2.5 py-1.5 text-[13px] hover:bg-surface"
                        >
                          <span
                            className="border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold uppercase"
                            style={{ background: it.kind === 'deadline' ? '#ff6b57' : '#6c8cff' }}
                          >
                            {it.kind === 'deadline' ? 'Deadline' : 'Interview'}
                          </span>
                          <span className="font-bold tabular-nums">{fmtDateTime(it.at)}</span>
                          <span className="text-muted">·</span>
                          <span className="flex-1 truncate font-semibold">
                            {it.label} — {it.app.company}
                          </span>
                          <span className="flex-none text-[12px] text-muted">
                            {relDays(it.at) || 'soon'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="border-3 border-ink bg-surface rounded p-4 shadow-hard-sm">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="font-display text-base font-bold uppercase tracking-wide">To-dos</h3>
                  <Link to="/todos" className="ml-auto text-[12px] font-bold text-muted underline hover:text-ink">
                    all →
                  </Link>
                </div>
                <QuickAddTodo apps={apps} onAdd={createTodo} showJobSelect />
                {dueTodos.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {dueTodos.map((t) => (
                      <TodoRow key={t.id} todo={t} apps={apps} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[13px] text-muted">Nothing due. Add one above, or check a job's suggestions.</p>
                )}
              </div>

              <div className="border-3 border-ink bg-surface rounded p-4 shadow-hard-sm">
                <h3 className="mb-3 font-display text-base font-bold uppercase tracking-wide">
                  Needs attention
                </h3>
                <AttnGroup
                  title="Gone quiet (14+ days, no reply)"
                  apps={attention.quiet}
                  action={(a) => (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        void createTodo({ text: `Follow up with ${a.company}`, applicationId: a.id })
                      }}
                      className="border-2 border-ink bg-ground px-1.5 text-[11px] font-bold hover:bg-accent-yellow"
                    >
                      ＋ follow-up
                    </button>
                  )}
                />
                <AttnGroup
                  title="Close the loop (30+ days, no reply — likely dead)"
                  apps={attention.dead}
                  headerAction={
                    attention.dead.length > 0 ? (
                      <button
                        onClick={() => void archiveApps(attention.dead.map((a) => a.id), true)}
                        className="border-2 border-ink bg-ground px-1.5 text-[11px] font-bold hover:bg-accent-coral"
                      >
                        Archive all ({attention.dead.length})
                      </button>
                    ) : undefined
                  }
                  action={(a) => (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        void archiveApps([a.id], true)
                      }}
                      className="border-2 border-ink bg-ground px-1.5 text-[11px] font-bold hover:bg-accent-coral"
                    >
                      archive
                    </button>
                  )}
                />
                <AttnGroup title="No resume attached" apps={attention.noResume} />
                <AttnGroup title="Interviewing, no prep to-do" apps={attention.noPrep} />
                {attention.quiet.length +
                  attention.dead.length +
                  attention.noResume.length +
                  attention.noPrep.length ===
                  0 && (
                  <p className="text-[13px] text-muted">All clear — nothing needs a nudge.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AttnGroup({
  title,
  apps,
  action,
  headerAction,
}: {
  title: string
  apps: import('@shared/types').Application[]
  action?: (a: import('@shared/types').Application) => React.ReactNode
  headerAction?: React.ReactNode
}) {
  if (apps.length === 0) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
        <span>
          {title} · {apps.length}
        </span>
        {headerAction && <span className="ml-auto normal-case">{headerAction}</span>}
      </div>
      <ul className="space-y-1">
        {apps.slice(0, 5).map((a) => (
          <li key={a.id}>
            <Link
              to={`/app/${a.id}`}
              className="flex items-center gap-2 border-2 border-ink bg-ground px-2 py-1 text-[12px] hover:bg-surface"
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center border-2 border-ink bg-surface text-[10px] font-bold">
                {initials(a.company)}
              </span>
              <span className="flex-1 truncate font-semibold">
                {a.roleTitle} · {a.company}
              </span>
              {action?.(a)}
            </Link>
          </li>
        ))}
        {apps.length > 5 && <li className="text-[11px] text-muted">+{apps.length - 5} more</li>}
      </ul>
    </div>
  )
}
