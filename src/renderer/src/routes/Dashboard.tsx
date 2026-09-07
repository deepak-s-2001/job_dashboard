import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAppData } from '@/lib/store'
import { useView } from '@/lib/view'
import { EMPTY_FILTERS, useFilteredApps } from '@/lib/filter'
import { AppCard } from '@/components/AppCard'
import { StatsStrip } from '@/components/StatsStrip'
import { FilterRail } from '@/components/FilterRail'
import { Button } from '@/components/ui/Button'
import { EmptyState, Spinner } from '@/components/ui/misc'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('filtersCollapsed') === '1'
  } catch {
    return false
  }
}

export function Dashboard() {
  const { apps, loading, error } = useAppData()
  const { query, setQuery, filters, setFilters, sort, setSort } = useView()
  const [railCollapsed, setRailCollapsed] = useState(readCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem('filtersCollapsed', railCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [railCollapsed])

  const results = useFilteredApps(apps, query, filters, sort)

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b-3 border-ink bg-ground/95 px-6 py-4 backdrop-blur">
        <h1 className="font-display text-2xl font-bold">All applications</h1>
        <span className="border-2 border-ink bg-surface px-2 py-0.5 text-sm font-bold">
          {results.length}
          {results.length !== apps.length && <span className="text-muted"> / {apps.length}</span>}
        </span>
        {(query || results.length !== apps.length) && (
          <span className="text-[13px] font-semibold text-muted">
            {query ? `matching “${query}”` : 'filtered'}
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {apps.length > 0 && (
          <FilterRail
            apps={apps}
            filters={filters}
            onChange={setFilters}
            collapsed={railCollapsed}
            onToggle={() => setRailCollapsed((v) => !v)}
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
          />
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
                  Clear search &amp; filters
                </Button>
              }
            >
              Try a looser search or fewer filters.
            </EmptyState>
          ) : (
            <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(310px,1fr))]">
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
