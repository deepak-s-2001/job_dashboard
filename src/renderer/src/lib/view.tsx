import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { EMPTY_FILTERS, type Filters, type SortKey } from './filter'

interface ViewState {
  query: string
  setQuery: (q: string) => void
  filters: Filters
  setFilters: (f: Filters) => void
  sort: SortKey
  setSort: (s: SortKey) => void
  /** true when a search or any filter is narrowing the list */
  narrowed: boolean
}

const Ctx = createContext<ViewState | null>(null)

function readSort(): SortKey {
  try {
    const v = localStorage.getItem('sortKey')
    if (v === 'applied-desc' || v === 'applied-asc' || v === 'posted-desc' || v === 'company-asc')
      return v
  } catch {
    /* ignore */
  }
  return 'applied-desc'
}

/**
 * Dashboard search / filter / sort state, lifted here so it survives route
 * changes and can be read from a job detail page (for in-context prev/next).
 */
export function ViewProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>(readSort)

  useEffect(() => {
    try {
      localStorage.setItem('sortKey', sort)
    } catch {
      /* ignore */
    }
  }, [sort])

  const value = useMemo<ViewState>(
    () => ({
      query,
      setQuery,
      filters,
      setFilters,
      sort,
      setSort,
      narrowed:
        query.trim().length > 0 ||
        JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS),
    }),
    [query, filters, sort],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useView(): ViewState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useView must be used inside <ViewProvider>')
  return ctx
}
