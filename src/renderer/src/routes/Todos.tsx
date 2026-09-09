import { useMemo, useState } from 'react'
import { useAppData } from '@/lib/store'
import { QuickAddTodo } from '@/components/QuickAddTodo'
import { TodoRow } from '@/components/TodoRow'
import { Select } from '@/components/ui/Select'
import { EmptyState, Spinner } from '@/components/ui/misc'
import { groupTodos } from '@/lib/todo'

export function Todos() {
  const { todos, apps, createTodo, loading, error } = useAppData()
  const [jobFilter, setJobFilter] = useState<string>('all') // 'all' | 'none' | <appId>
  const [showDone, setShowDone] = useState(false)

  const openCount = todos.filter((t) => !t.done).length

  const filtered = useMemo(() => {
    let list = todos
    if (jobFilter === 'none') list = list.filter((t) => !t.applicationId)
    else if (jobFilter !== 'all') list = list.filter((t) => t.applicationId === jobFilter)
    return list
  }, [todos, jobFilter])

  const groups = useMemo(
    () => groupTodos(filtered).filter((g) => (g.key === 'done' ? showDone : true) && g.items.length),
    [filtered, showDone],
  )

  const jobOptions = useMemo(
    () => [
      { value: 'all', label: 'All to-dos' },
      { value: 'none', label: 'Not linked to a job' },
      ...apps.map((a) => ({ value: a.id, label: `${a.roleTitle} · ${a.company}` })),
    ],
    [apps],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b-3 border-ink bg-ground/95 px-6 py-4 backdrop-blur">
        <h1 className="font-display text-2xl font-bold">To-dos</h1>
        <span className="border-2 border-ink bg-surface px-2 py-0.5 text-sm font-bold">
          {openCount} open
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              className="h-4 w-4 accent-[#141414]"
            />
            show done
          </label>
          <Select
            value={jobFilter}
            onChange={setJobFilter}
            options={jobOptions}
            ariaLabel="Filter by job"
            align="right"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto nb-scroll p-6">
        {error && (
          <div className="mb-4 border-3 border-ink bg-accent-coral p-3 text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          <QuickAddTodo apps={apps} onAdd={createTodo} showJobSelect />

          {loading && todos.length === 0 ? (
            <div className="mt-6 flex items-center gap-2 text-muted">
              <Spinner /> Loading…
            </div>
          ) : groups.length === 0 ? (
            todos.length === 0 ? (
              <EmptyState emoji="✓" title="Nothing to do yet">
                Add one above, or open a job and check its <strong>To-dos</strong> tab for
                suggested next steps.
              </EmptyState>
            ) : (
              <p className="mt-8 text-center text-sm text-muted">
                Nothing open here. {!showDone && 'Tick "show done" to see completed items.'}
              </p>
            )
          ) : (
            <div className="mt-5 space-y-5">
              {groups.map((g) => (
                <section key={g.key}>
                  <div className="mb-2 flex items-center gap-2">
                    {g.accent && (
                      <span
                        className="h-3 w-3 border-2 border-ink"
                        style={{ background: g.accent }}
                      />
                    )}
                    <h2 className="font-display text-sm font-bold uppercase tracking-wide">
                      {g.label}
                    </h2>
                    <span className="text-[12px] font-bold text-muted">{g.items.length}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {g.items.map((t) => (
                      <TodoRow key={t.id} todo={t} apps={apps} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
