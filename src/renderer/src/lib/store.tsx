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
  NewApplicationInput,
  Settings,
  TagDef,
  UsageTotals,
} from '@shared/types'
import { api, call } from './api'

interface AppData {
  apps: Application[]
  tags: TagDef[]
  settings: Settings
  usage: UsageTotals
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  refreshMeta: () => Promise<void>
  createApp: (input: NewApplicationInput) => Promise<Application>
  updateApp: (id: string, patch: Partial<Application>) => Promise<Application>
  removeApp: (id: string) => Promise<void>
}

const Ctx = createContext<AppData | null>(null)

const DEFAULT_SETTINGS: Settings = { extractionModel: 'claude-haiku-4-5', hasApiKey: false }
const DEFAULT_USAGE: UsageTotals = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<Application[]>([])
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
      const [a, t] = await Promise.all([call(api.apps.list()), call(api.tags.list())])
      if (!mounted.current) return
      setApps(a)
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

  const value = useMemo<AppData>(
    () => ({
      apps,
      tags,
      settings,
      usage,
      loading,
      error,
      refresh,
      refreshMeta,
      createApp,
      updateApp,
      removeApp,
    }),
    [apps, tags, settings, usage, loading, error, refresh, refreshMeta, createApp, updateApp, removeApp],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>')
  return ctx
}
