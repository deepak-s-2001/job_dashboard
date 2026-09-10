import { useMemo, useRef } from 'react'
import type { Application } from '@shared/types'
import { APPLICATION_STATUSES, EMPLOYMENT_TYPES, WORKPLACE_TYPES } from '@shared/types'
import { EMPTY_FILTERS, filtersActive, type Filters, type SortKey } from '@/lib/filter'
import { SOURCE_LABEL, STATUS_HEX, statusLabel, titleCase } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Input } from './ui/Field'
import { Select } from './ui/Select'
import { DateField } from './ui/DatePicker'

type ArrayKey = 'status' | 'employmentType' | 'workplaceType' | 'sourceSite' | 'tags'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'applied-desc', label: 'Newest applied' },
  { value: 'applied-asc', label: 'Oldest applied' },
  { value: 'posted-desc', label: 'Recently posted' },
  { value: 'company-asc', label: 'Company A–Z' },
]

export function FilterRail({
  apps,
  filters,
  onChange,
  collapsed,
  onToggle,
  query,
  onQuery,
  sort,
  onSort,
}: {
  apps: Application[]
  filters: Filters
  onChange: (f: Filters) => void
  collapsed: boolean
  onToggle: () => void
  query: string
  onQuery: (q: string) => void
  sort: SortKey
  onSort: (s: SortKey) => void
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  const facets = useMemo(() => {
    const count = (fn: (a: Application) => string | null | undefined) => {
      const m = new Map<string, number>()
      for (const a of apps) {
        const v = fn(a)
        if (v) m.set(v, (m.get(v) ?? 0) + 1)
      }
      return m
    }
    return {
      source: count((a) => a.sourceSite),
      tags: (() => {
        const m = new Map<string, number>()
        for (const a of apps) for (const t of a.tags) m.set(t, (m.get(t) ?? 0) + 1)
        return m
      })(),
      employment: count((a) => a.employmentType),
      workplace: count((a) => a.workplaceType),
      status: count((a) => a.status),
    }
  }, [apps])

  const toggle = (key: ArrayKey, val: string) => {
    const cur = filters[key] as string[]
    onChange({
      ...filters,
      [key]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val],
    })
  }

  const active = filtersActive(filters)

  if (collapsed) {
    return (
      <div className="flex w-12 flex-none flex-col items-center gap-2.5 border-r-3 border-ink bg-surface py-3">
        <button
          onClick={onToggle}
          title="Show search & filters"
          className="nb-focus flex h-8 w-8 items-center justify-center border-3 border-ink bg-accent-yellow text-lg font-bold hover:-translate-y-[1px] hover:shadow-hard-sm"
        >
          ›
        </button>
        <button
          onClick={onToggle}
          title="Search"
          className="nb-focus flex h-8 w-8 items-center justify-center border-2 border-ink bg-surface text-base hover:bg-ground"
        >
          ⌕
        </button>
        <div className="[writing-mode:vertical-rl] rotate-180 text-[12px] font-bold uppercase tracking-[0.2em] text-muted">
          Search &amp; filters
        </div>
        {(active > 0 || query) && (
          <span className="border-2 border-ink bg-accent-yellow px-1 text-[12px] font-bold">
            {active + (query ? 1 : 0)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="m-4 mr-0 flex w-72 flex-none flex-col border-3 border-ink bg-surface rounded shadow-hard">
      <div className="flex items-center justify-between border-b-3 border-ink px-3 py-2.5">
        <span className="font-display text-[15px] font-bold uppercase tracking-wide">Find</span>
        <button
          onClick={onToggle}
          title="Hide panel"
          className="nb-focus flex h-7 w-7 items-center justify-center border-2 border-ink bg-ground text-base font-bold hover:bg-accent-coral"
        >
          ‹
        </button>
      </div>

      <div className="space-y-2.5 border-b-3 border-ink p-3">
        <div className="relative">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search company, role…"
            className="h-10 pl-8 pr-8 text-[15px]"
          />
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
            ⌕
          </span>
          {query && (
            <button
              onClick={() => {
                onQuery('')
                searchRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none text-muted hover:text-ink"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <Select
          value={sort}
          onChange={(v) => onSort(v as SortKey)}
          options={SORT_OPTIONS}
          disabled={!!query}
          ariaLabel="Sort applications"
          title={query ? 'Ordered by search relevance while searching' : 'Sort'}
        />
      </div>

      <div className="flex items-center justify-between border-b-3 border-ink px-3 py-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-muted">
          Filters {active > 0 && <span className="text-ink">· {active}</span>}
        </span>
        {active > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-[13px] font-bold text-muted underline hover:text-ink"
          >
            clear
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto nb-scroll p-3">
        {facets.status.size > 0 && (
          <Group title="Status">
            {APPLICATION_STATUSES.filter((s) => facets.status.has(s)).map((s) => (
              <Check
                key={s}
                checked={filters.status.includes(s)}
                onClick={() => toggle('status', s)}
                swatch={STATUS_HEX[s]}
                label={statusLabel(s)}
                count={facets.status.get(s)}
              />
            ))}
          </Group>
        )}

        <Group title="Applied between">
          <div className="space-y-1.5">
            <DateField
              size="sm"
              ariaLabel="Applied from"
              placeholder="From"
              value={filters.appliedFrom ?? null}
              onChange={(v) => onChange({ ...filters, appliedFrom: v })}
            />
            <DateField
              size="sm"
              ariaLabel="Applied to"
              placeholder="To"
              value={filters.appliedTo ?? null}
              onChange={(v) => onChange({ ...filters, appliedTo: v })}
            />
          </div>
        </Group>

        {facets.employment.size > 0 && (
          <Group title="Employment">
            {EMPLOYMENT_TYPES.filter((t) => facets.employment.has(t)).map((t) => (
              <Check
                key={t}
                checked={filters.employmentType.includes(t)}
                onClick={() => toggle('employmentType', t)}
                label={titleCase(t)}
                count={facets.employment.get(t)}
              />
            ))}
          </Group>
        )}

        {facets.workplace.size > 0 && (
          <Group title="Workplace">
            {WORKPLACE_TYPES.filter((t) => facets.workplace.has(t)).map((t) => (
              <Check
                key={t}
                checked={filters.workplaceType.includes(t)}
                onClick={() => toggle('workplaceType', t)}
                label={titleCase(t)}
                count={facets.workplace.get(t)}
              />
            ))}
          </Group>
        )}

        {facets.source.size > 1 && (
          <Group title="Source">
            {[...facets.source.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => (
                <Check
                  key={s}
                  checked={filters.sourceSite.includes(s)}
                  onClick={() => toggle('sourceSite', s)}
                  label={SOURCE_LABEL[s] ?? titleCase(s)}
                  count={n}
                />
              ))}
          </Group>
        )}

        {facets.tags.size > 0 && (
          <Group title="Tags">
            {[...facets.tags.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([t, n]) => (
                <Check
                  key={t}
                  checked={filters.tags.includes(t)}
                  onClick={() => toggle('tags', t)}
                  label={`#${t}`}
                  count={n}
                />
              ))}
          </Group>
        )}

        <Group title="Other">
          <TriToggle
            label="Has a resume"
            value={filters.hasResume}
            onChange={(v) => onChange({ ...filters, hasResume: v })}
          />
          <TriToggle
            label="AI-extracted"
            value={filters.extracted}
            onChange={(v) => onChange({ ...filters, extracted: v })}
          />
          <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-[14px] font-semibold">Archived</span>
            <div className="flex border-2 border-ink">
              {(['hide', 'only', 'all'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...filters, archived: v })}
                  className={cn(
                    'px-1.5 py-0.5 text-[11px] font-bold uppercase',
                    filters.archived === v ? 'bg-ink text-ground' : 'bg-surface hover:bg-ground',
                    v !== 'hide' && 'border-l-2 border-ink',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </Group>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Check({
  checked,
  onClick,
  label,
  count,
  swatch,
}: {
  checked: boolean
  onClick: () => void
  label: string
  count?: number
  swatch?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'nb-focus flex w-full items-center gap-2 border-2 px-1.5 py-1 text-[14px] font-semibold',
        checked ? 'border-ink bg-accent-yellow' : 'border-transparent hover:border-ink/40',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 flex-none items-center justify-center border-2 border-ink text-[10px]',
          checked ? 'bg-ink text-ground' : 'bg-surface',
        )}
      >
        {checked ? '✓' : ''}
      </span>
      {swatch && (
        <span className="h-3 w-3 flex-none border border-ink" style={{ background: swatch }} />
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && <span className="text-[12px] text-muted">{count}</span>}
    </button>
  )
}

function TriToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: 'any' | 'yes' | 'no'
  onChange: (v: 'any' | 'yes' | 'no') => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[14px] font-semibold">{label}</span>
      <div className="flex border-2 border-ink">
        {(['any', 'yes', 'no'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              'px-1.5 py-0.5 text-[11px] font-bold uppercase',
              value === v ? 'bg-ink text-ground' : 'bg-surface hover:bg-ground',
              v !== 'any' && 'border-l-2 border-ink',
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
