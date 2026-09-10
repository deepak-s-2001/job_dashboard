import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Application,
  Contact,
  NewApplicationInput,
  NewContactInput,
  NewTodoInput,
  Settings,
  TagDef,
  Todo,
  UsageTotals,
  UserProfile,
} from '@shared/types'
import { EMPTY_PROFILE } from '@shared/types'
import { api, call } from './api'

interface AppData {
  apps: Application[]
  contacts: Contact[]
  todos: Todo[]
  tags: TagDef[]
  settings: Settings
  usage: UsageTotals
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  refreshMeta: () => Promise<void>
  createApp: (input: NewApplicationInput) => Promise<Application>
  createAppsBulk: (inputs: NewApplicationInput[]) => Promise<Application[]>
  updateApp: (id: string, patch: Partial<Application>) => Promise<Application>
  archiveApps: (ids: string[], archived: boolean) => Promise<void>
  removeApp: (id: string) => Promise<void>
  createContact: (input: NewContactInput) => Promise<Contact>
  updateContact: (id: string, patch: Partial<Contact>) => Promise<Contact>
  removeContact: (id: string) => Promise<void>
  linkContact: (appId: string, contactId: string) => Promise<void>
  unlinkContact: (appId: string, contactId: string) => Promise<void>
  createTodo: (input: NewTodoInput) => Promise<Todo>
  updateTodo: (id: string, patch: Partial<Todo>) => Promise<Todo>
  removeTodo: (id: string) => Promise<void>
  saveProfile: (p: UserProfile) => Promise<void>
}

const Ctx = createContext<AppData | null>(null)

const DEFAULT_SETTINGS: Settings = {
  extractionModel: 'claude-haiku-4-5',
  hasApiKey: false,
  profile: EMPTY_PROFILE,
}
const DEFAULT_USAGE: UsageTotals = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<Application[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [tags, setTags] = useState<TagDef[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [usage, setUsage] = useState<UsageTotals>(DEFAULT_USAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [a, c, d, t] = await Promise.all([
        call(api.apps.list()),
        call(api.contacts.list()),
        call(api.todos.list()),
        call(api.tags.list()),
      ])
      if (!mounted.current) return
      setApps(a)
      setContacts(c)
      setTodos(d)
      setTags(t)
      setError(null)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const refreshMeta = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([call(api.settings.get()), call(api.usage.get())])
      if (!mounted.current) return
      setSettings(s)
      setUsage(u)
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await Promise.all([refresh(), refreshMeta()])
      if (mounted.current) setLoading(false)
    })()
  }, [refresh, refreshMeta])

  const createApp = useCallback(
    async (input: NewApplicationInput) => {
      const created = await call(api.apps.create(input))
      await refresh()
      return created
    },
    [refresh],
  )

  const createAppsBulk = useCallback(
    async (inputs: NewApplicationInput[]) => {
      const created = await call(api.apps.createBulk(inputs))
      await refresh()
      return created
    },
    [refresh],
  )

  const archiveApps = useCallback(
    async (ids: string[], archived: boolean) => {
      await call(api.apps.bulkArchive(ids, archived))
      await refresh()
    },
    [refresh],
  )

  const updateApp = useCallback(
    async (id: string, patch: Partial<Application>) => {
      const updated = await call(api.apps.update(id, patch))
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)))
      void refresh()
      return updated
    },
    [refresh],
  )

  const removeApp = useCallback(
    async (id: string) => {
      await call(api.apps.remove(id))
      setApps((prev) => prev.filter((a) => a.id !== id))
    },
    [],
  )

  const createContact = useCallback(
    async (input: NewContactInput) => {
      const created = await call(api.contacts.create(input))
      await refresh()
      return created
    },
    [refresh],
  )

  const updateContact = useCallback(
    async (id: string, patch: Partial<Contact>) => {
      const updated = await call(api.contacts.update(id, patch))
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)))
      void refresh()
      return updated
    },
    [refresh],
  )

  const removeContact = useCallback(
    async (id: string) => {
      await call(api.contacts.remove(id))
      await refresh()
    },
    [refresh],
  )

  const linkContact = useCallback(
    async (appId: string, contactId: string) => {
      const target = apps.find((a) => a.id === appId)
      const next = Array.from(new Set([...(target?.contactIds ?? []), contactId]))
      await call(api.apps.update(appId, { contactIds: next }))
      await refresh()
    },
    [apps, refresh],
  )

  const unlinkContact = useCallback(
    async (appId: string, contactId: string) => {
      const target = apps.find((a) => a.id === appId)
      const next = (target?.contactIds ?? []).filter((id) => id !== contactId)
      await call(api.apps.update(appId, { contactIds: next }))
      await refresh()
    },
    [apps, refresh],
  )

  const createTodo = useCallback(
    async (input: NewTodoInput) => {
      const created = await call(api.todos.create(input))
      await refresh()
      return created
    },
    [refresh],
  )

  const updateTodo = useCallback(
    async (id: string, patch: Partial<Todo>) => {
      const updated = await call(api.todos.update(id, patch))
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
      void refresh()
      return updated
    },
    [refresh],
  )

  const removeTodo = useCallback(
    async (id: string) => {
      await call(api.todos.remove(id))
      setTodos((prev) => prev.filter((t) => t.id !== id))
    },
    [],
  )

  const saveProfile = useCallback(
    async (p: UserProfile) => {
      await call(api.settings.setProfile(p))
      await refreshMeta()
    },
    [refreshMeta],
  )

  const value = useMemo<AppData>(
    () => ({
      apps,
      contacts,
      todos,
      tags,
      settings,
      usage,
      loading,
      error,
      refresh,
      refreshMeta,
      createApp,
      createAppsBulk,
      updateApp,
      archiveApps,
      removeApp,
      createContact,
      updateContact,
      removeContact,
      linkContact,
      unlinkContact,
      createTodo,
      updateTodo,
      removeTodo,
      saveProfile,
    }),
    [
      apps, contacts, todos, tags, settings, usage, loading, error, refresh, refreshMeta,
      createApp, createAppsBulk, updateApp, archiveApps, removeApp, createContact, updateContact,
      removeContact, linkContact, unlinkContact, createTodo, updateTodo, removeTodo, saveProfile,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>')
  return ctx
}
