import { useState, type FormEvent } from 'react'
import type { Application, NewTodoInput } from '@shared/types'
import { Select } from './ui/Select'
import { DateField } from './ui/DatePicker'
import { cn } from '@/lib/cn'
import { todayIso } from '@/lib/format'
import { plusDaysIso } from '@/lib/todo'

interface Props {
  apps: Application[]
  onAdd: (input: NewTodoInput) => void | Promise<unknown>
  defaultApplicationId?: string | null
  showJobSelect?: boolean
}

const QUICK: { label: string; value: () => string }[] = [
  { label: 'Today', value: () => todayIso() },
  { label: 'Tomorrow', value: () => plusDaysIso(1) },
  { label: '+1 wk', value: () => plusDaysIso(7) },
]

export function QuickAddTodo({ apps, onAdd, defaultApplicationId = null, showJobSelect }: Props) {
  const [text, setText] = useState('')
  const [due, setDue] = useState<string | null>(null)
  const [appId, setAppId] = useState<string | null>(defaultApplicationId)

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    void onAdd({ text: t, applicationId: appId, dueDate: due })
    setText('')
    setDue(null)
    // keep the chosen job — usually you add a few in a row for the same one
  }

  return (
    <form onSubmit={submit} className="border-3 border-ink bg-surface rounded p-2.5">
      <div className="flex items-center gap-2">
        <span className="pl-1 text-lg leading-none text-muted">＋</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a to-do and press Enter…"
          className="flex-1 bg-transparent py-1 text-[15px] outline-none placeholder:text-muted/90"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {QUICK.map((q) => {
          const v = q.value()
          const on = due === v
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => setDue(on ? null : v)}
              className={cn(
                'border-2 border-ink px-2 py-0.5 text-[12px] font-bold',
                on ? 'bg-accent-yellow' : 'bg-ground hover:bg-accent-yellow/40',
              )}
            >
              {q.label}
            </button>
          )
        })}
        <div className="w-[150px]">
          <DateField
            size="sm"
            ariaLabel="Due date"
            placeholder="📅 Pick a date"
            value={due && !QUICK.some((q) => q.value() === due) ? due : null}
            onChange={(v) => setDue(v)}
          />
        </div>
        {due && (
          <button
            type="button"
            onClick={() => setDue(null)}
            className="text-[12px] font-bold text-muted underline hover:text-ink"
          >
            clear date
          </button>
        )}

        {showJobSelect && (
          <div className="ml-auto">
            <Select
              value={appId ?? ''}
              onChange={(v) => setAppId(v || null)}
              ariaLabel="Link to a job"
              options={[
                { value: '', label: 'No job' },
                ...apps.map((a) => ({ value: a.id, label: `${a.roleTitle} · ${a.company}` })),
              ]}
            />
          </div>
        )}
      </div>
    </form>
  )
}
