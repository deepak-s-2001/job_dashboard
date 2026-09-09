import type { Todo } from '@shared/types'
import { todayIso } from './format'

export function plusDaysIso(n: number, from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** whole-day difference: dueDate - today (negative = overdue) */
function dayDelta(dueDate: string): number {
  const a = new Date(dueDate + 'T00:00:00').getTime()
  const b = new Date(todayIso() + 'T00:00:00').getTime()
  return Math.round((a - b) / 86_400_000)
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Short label for the due pill. */
export function dueLabel(dueDate: string | null): string {
  if (!dueDate) return ''
  const delta = dayDelta(dueDate)
  if (delta < -1) return `Overdue ${-delta}d`
  if (delta === -1) return 'Yesterday'
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  const d = new Date(dueDate + 'T00:00:00')
  if (delta < 7) return WEEKDAY[d.getDay()]
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function isOverdue(t: Todo): boolean {
  return !t.done && !!t.dueDate && dayDelta(t.dueDate) < 0
}
export function isDueToday(t: Todo): boolean {
  return !t.done && !!t.dueDate && dayDelta(t.dueDate) === 0
}

/** done last, then by due date asc (no-date last), then oldest first. */
export function sortTodos(a: Todo, b: Todo): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  if (a.done && b.done) return (b.doneAt ?? '').localeCompare(a.doneAt ?? '')
  const ad = a.dueDate ?? '9999-99-99'
  const bd = b.dueDate ?? '9999-99-99'
  if (ad !== bd) return ad.localeCompare(bd)
  return a.createdAt.localeCompare(b.createdAt)
}

export interface TodoGroup {
  key: 'overdue' | 'today' | 'week' | 'later' | 'nodate' | 'done'
  label: string
  accent: string | null
  items: Todo[]
}

const DONE_CAP = 30

/** Buckets for the list view, in display order. Empty groups are dropped by the caller. */
export function groupTodos(todos: Todo[]): TodoGroup[] {
  const g: Record<TodoGroup['key'], Todo[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    nodate: [],
    done: [],
  }
  for (const t of todos) {
    if (t.done) {
      g.done.push(t)
      continue
    }
    if (!t.dueDate) {
      g.nodate.push(t)
      continue
    }
    const delta = dayDelta(t.dueDate)
    if (delta < 0) g.overdue.push(t)
    else if (delta === 0) g.today.push(t)
    else if (delta < 7) g.week.push(t)
    else g.later.push(t)
  }
  for (const k of Object.keys(g) as TodoGroup['key'][]) g[k].sort(sortTodos)
  g.done = g.done.slice(0, DONE_CAP)
  return [
    { key: 'overdue', label: 'Overdue', accent: '#ff6b57', items: g.overdue },
    { key: 'today', label: 'Today', accent: '#ffc900', items: g.today },
    { key: 'week', label: 'This week', accent: '#6c8cff', items: g.week },
    { key: 'later', label: 'Later', accent: null, items: g.later },
    { key: 'nodate', label: 'No date', accent: null, items: g.nodate },
    { key: 'done', label: 'Done', accent: null, items: g.done },
  ]
}
