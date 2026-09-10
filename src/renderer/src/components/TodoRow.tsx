import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application, Todo } from '@shared/types'
import { useAppData } from '@/lib/store'
import { useToast } from './ui/Toast'
import { cn } from '@/lib/cn'
import { DateField } from './ui/DatePicker'
import { initials, todayIso } from '@/lib/format'
import { dueLabel, isOverdue, isDueToday, plusDaysIso } from '@/lib/todo'

const QUICK: { label: string; iso: () => string }[] = [
  { label: 'Today', iso: () => todayIso() },
  { label: 'Tmrw', iso: () => plusDaysIso(1) },
  { label: '+1wk', iso: () => plusDaysIso(7) },
]

export function TodoRow({
  todo,
  apps,
  showJob = true,
}: {
  todo: Todo
  apps: Application[]
  showJob?: boolean
}) {
  const { updateTodo, removeTodo } = useAppData()
  const toast = useToast()
  const navigate = useNavigate()
  const [editingText, setEditingText] = useState(false)
  const [editingDue, setEditingDue] = useState(false)

  const job = todo.applicationId ? apps.find((a) => a.id === todo.applicationId) : null
  const overdue = isOverdue(todo)

  function saveText(v: string) {
    setEditingText(false)
    const t = v.trim()
    if (t && t !== todo.text) void updateTodo(todo.id, { text: t })
  }
  function onTextKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') saveText((e.target as HTMLInputElement).value)
    else if (e.key === 'Escape') setEditingText(false)
  }

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 border-2 border-ink bg-surface px-2.5 py-1.5',
        todo.done && 'bg-ground',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? 'Mark not done' : 'Mark done'}
        onClick={() => void updateTodo(todo.id, { done: !todo.done })}
        className={cn(
          'nb-focus flex h-5 w-5 flex-none items-center justify-center border-2 border-ink text-[12px] font-bold',
          todo.done ? 'bg-accent-lime' : 'bg-surface hover:bg-accent-lime/40',
        )}
      >
        {todo.done ? '✓' : ''}
      </button>

      {editingText ? (
        <input
          autoFocus
          defaultValue={todo.text}
          onBlur={(e) => saveText(e.target.value)}
          onKeyDown={onTextKey}
          className="flex-1 border-b-2 border-ink bg-transparent py-0.5 text-[14px] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingText(true)}
          title="Click to edit"
          className={cn(
            'flex-1 truncate text-left text-[14px] font-medium',
            todo.done && 'text-muted line-through',
          )}
        >
          {todo.text}
        </button>
      )}

      {showJob && job && (
        <button
          type="button"
          onClick={() => navigate(`/app/${job.id}`)}
          title={`${job.roleTitle} · ${job.company}`}
          className="flex flex-none items-center gap-1 border-2 border-ink bg-ground px-1.5 py-0.5 text-[11px] font-bold hover:bg-accent-yellow"
        >
          <span>{initials(job.company)}</span>
          <span className="max-w-[10ch] truncate font-semibold">{job.roleTitle}</span>
        </button>
      )}

      {editingDue ? (
        <span className="flex flex-none items-center gap-1">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                void updateTodo(todo.id, { dueDate: q.iso() })
                setEditingDue(false)
              }}
              className="border-2 border-ink bg-ground px-1.5 py-0.5 text-[11px] font-bold hover:bg-accent-yellow"
            >
              {q.label}
            </button>
          ))}
          <div className="w-[150px]">
            <DateField
              size="sm"
              ariaLabel="Due date"
              value={todo.dueDate ?? null}
              onChange={(v) => {
                void updateTodo(todo.id, { dueDate: v })
                setEditingDue(false)
              }}
            />
          </div>
          {todo.dueDate && (
            <button
              type="button"
              onClick={() => {
                void updateTodo(todo.id, { dueDate: null })
                setEditingDue(false)
              }}
              className="text-[11px] font-bold text-muted underline hover:text-ink"
            >
              clear
            </button>
          )}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setEditingDue(true)}
          className={cn(
            'flex-none border-2 px-1.5 py-0.5 text-[11px] font-bold',
            todo.dueDate
              ? overdue
                ? 'border-ink bg-accent-coral'
                : isDueToday(todo)
                  ? 'border-ink bg-accent-yellow'
                  : 'border-ink bg-ground'
              : 'border-dashed border-ink text-muted hover:border-solid',
          )}
        >
          {todo.dueDate ? dueLabel(todo.dueDate) : '+ date'}
        </button>
      )}

      <button
        type="button"
        aria-label="Delete to-do"
        onClick={async () => {
          await removeTodo(todo.id)
          toast.push('info', 'To-do deleted.')
        }}
        className="nb-focus flex-none px-1 text-ink/50 hover:text-accent-coral"
      >
        ×
      </button>
    </li>
  )
}
