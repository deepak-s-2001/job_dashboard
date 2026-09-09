import { useMemo } from 'react'
import type { Application } from '@shared/types'
import { useAppData } from '@/lib/store'
import { QuickAddTodo } from './QuickAddTodo'
import { TodoRow } from './TodoRow'
import { sortTodos } from '@/lib/todo'
import { suggestionsFor } from '@/lib/todoSuggest'

export function JobTodos({ app }: { app: Application }) {
  const { todos, apps, createTodo } = useAppData()

  const mine = useMemo(
    () => todos.filter((t) => t.applicationId === app.id).sort(sortTodos),
    [todos, app.id],
  )
  const suggestions = useMemo(
    () => suggestionsFor(app, mine.map((t) => t.text)),
    [app, mine],
  )

  return (
    <div className="space-y-4">
      <QuickAddTodo apps={apps} onAdd={createTodo} defaultApplicationId={app.id} />

      {mine.length > 0 ? (
        <ul className="space-y-1.5">
          {mine.map((t) => (
            <TodoRow key={t.id} todo={t} apps={apps} showJob={false} />
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-muted">Nothing for this job yet.</p>
      )}

      {suggestions.length > 0 && (
        <div>
          <h4 className="mb-2 font-display text-[12px] font-bold uppercase tracking-wide text-muted">
            Suggested — for a job that's {app.status.replace('-', ' ')}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void createTodo({ text: s, applicationId: app.id })}
                className="border-2 border-dashed border-ink px-2 py-1 text-[13px] font-medium text-muted hover:border-solid hover:bg-accent-lime hover:text-ink"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
