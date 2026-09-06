import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAppData } from '@/lib/store'
import { EMPTY_FILTERS, filtersActive, useFilteredApps, type Filters, type SortKey } from '@/lib/filter'
import { AppCard } from '@/components/AppCard'
import { StatsStrip } from '@/components/StatsStrip'
import { FilterRail } from '@/components/FilterRail'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { EmptyState, Spinner } from '@/components/ui/misc'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'applied-desc', label: 'Newest applied' },
  { key: 'applied-asc', label: 'Oldest applied' },
  { key: 'posted-desc', label: 'Recently posted' },
  { key: 'company-asc', label: 'Company A–Z' },
]

export function Dashboard() {
  const { apps, loading, error } = useAppData()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('applied-desc')
  const [showFilters, setShowFilters] = useState(true)

  const results = useFilteredApps(apps, query, filters, sort)
  const activeFilters = filtersActive(filters)

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b-3 border-ink bg-ground/95 backdrop-blur">
        <div className="flex items-center gap-3 px-6 py-4">
          <h1 className="font-display text-2xl font-bold">All applications</h1>
          <span className="border-2 border-ink bg-surface px-1.5 py-0.5 text-[12px] font-bold">
            {results.length}
            {results.length !== apps.length && <span className="text-muted"> / {apps.length}</span>}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-10 w-56 pl-8"
              />
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                ⌕
              </span>
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  ×
                </button>
              )}
            </div>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 w-40"
              disabled={!!query}
              title={query ? 'Sorted by search relevance' : undefined}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
            {apps.length > 0 && (
              <Button
                variant={showFilters ? 'accent' : 'outline'}
                onClick={() => setShowFilters((v) => !v)}
              >
                Filters {activeFilters > 0 && `(${activeFilters})`}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {showFilters && apps.length > 0 && (
          <div className="w-60 flex-none overflow-hidden p-4 pr-0">
            <FilterRail apps={apps} filters={filters} onChange={setFilters} />
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto nb-scroll p-6">
          {apps.length > 0 && (
            <div className="mb-5">
              <StatsStrip apps={apps} />
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-20 text-muted">
              <Spinner /> Loading your applications…
            </div>
          ) : error ? (
            <EmptyState emoji="⚠️" title="Could not load your data">
              {error}
            </EmptyState>
          ) : apps.length === 0 ? (
            <EmptyState
              emoji="🗂️"
              title="No applications yet"
              action={
                <Link to="/add">
                  <Button variant="primary" size="lg">
                    Add your first one
                  </Button>
                </Link>
              }
            >
              Paste a job link and the app pulls in the company, description and date. Then you
              attach the resume you sent.
            </EmptyState>
          ) : results.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="Nothing matches"
              action={
                <Button
                  onClick={() => {
                    setQuery('')
                    setFilters(EMPTY_FILTERS)
                  }}
                >
                  Clear search & filters
                </Button>
              }
            >
              Try a looser search or fewer filters.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {results.map((a) => (
                  <AppCard key={a.id} app={a} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
