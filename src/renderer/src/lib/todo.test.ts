import { describe, expect, it } from 'vitest'
import type { Todo } from '@shared/types'
import { dueLabel, groupTodos, sortTodos, plusDaysIso } from './todo'

const todo = (over: Partial<Todo>): Todo => ({
  id: Math.random().toString(36).slice(2),
  text: 't',
  done: false,
  doneAt: null,
  applicationId: null,
  dueDate: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('dueLabel', () => {
  it('labels relative days', () => {
    expect(dueLabel(null)).toBe('')
    expect(dueLabel(plusDaysIso(0))).toBe('Today')
    expect(dueLabel(plusDaysIso(1))).toBe('Tomorrow')
    expect(dueLabel(plusDaysIso(-1))).toBe('Yesterday')
    expect(dueLabel(plusDaysIso(-3))).toBe('Overdue 3d')
  })
})

describe('groupTodos', () => {
  it('buckets by due date and done', () => {
    const todos = [
      todo({ dueDate: plusDaysIso(-2) }),
      todo({ dueDate: plusDaysIso(0) }),
      todo({ dueDate: plusDaysIso(3) }),
      todo({ dueDate: plusDaysIso(30) }),
      todo({ dueDate: null }),
      todo({ done: true, doneAt: '2026-02-02T00:00:00Z' }),
    ]
    const g = Object.fromEntries(groupTodos(todos).map((x) => [x.key, x.items.length]))
    expect(g).toMatchObject({ overdue: 1, today: 1, week: 1, later: 1, nodate: 1, done: 1 })
  })

  it('a done to-do never appears in a date bucket even with a past due date', () => {
    const g = groupTodos([todo({ done: true, dueDate: plusDaysIso(-5) })])
    expect(g.find((x) => x.key === 'overdue')!.items).toEqual([])
    expect(g.find((x) => x.key === 'done')!.items).toHaveLength(1)
  })
})

describe('sortTodos', () => {
  it('open before done, then by due date, then oldest first', () => {
    const a = todo({ id: 'a', dueDate: plusDaysIso(5), createdAt: '2026-01-01T00:00:00Z' })
    const b = todo({ id: 'b', dueDate: plusDaysIso(1), createdAt: '2026-01-02T00:00:00Z' })
    const c = todo({ id: 'c', dueDate: null, createdAt: '2026-01-03T00:00:00Z' })
    const d = todo({ id: 'd', done: true, doneAt: '2026-05-01T00:00:00Z' })
    expect([a, b, c, d].sort(sortTodos).map((t) => t.id)).toEqual(['b', 'a', 'c', 'd'])
  })
})
