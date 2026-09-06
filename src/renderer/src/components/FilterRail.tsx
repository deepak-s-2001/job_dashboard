import { useMemo } from 'react'
import type { Application } from '@shared/types'
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  WORKPLACE_TYPES,
} from '@shared/types'
import { EMPTY_FILTERS, filtersActive, type Filters } from '@/lib/filter'
import { SOURCE_LABEL, STATUS_HEX, titleCase } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Input } from './ui/Field'

type ArrayKey = 'status' | 'employmentType' | 'workplaceType' | 'sourceSite' | 'tags'

export function FilterRail({
  apps,
  filters,
  onChange,
}: {
  apps: Application[]
  filters: Filters
  onChange: (f: Filters) => void
}) {
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

  return (
    <div className="flex h-full flex-col border-3 border-ink bg-surface rounded shadow-hard">
      <div className="flex items-center justify-between border-b-3 border-ink px-3 py-2">
        <span className="font-display text-sm font-bold uppercase tracking-wide">
          Filters {active > 0 && <span className="ml-1 rounded bg-accent-yellow px-1.5">{active}</span>}
        </span>
        {active > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-[11px] font-bold text-muted underline hover:text-ink"
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
                label={titleCase(s)}
                count={facets.status.get(s)}
              />
            ))}
          </Group>
        )}

        <Group title="Applied between">
          <div className="space-y-1.5">
            <Input
              type="date"
              value={filters.appliedFrom ?? ''}
              onChange={(e) => onChange({ ...filters, appliedFrom: e.target.value || null })}
              className="h-9 px-2 text-[13px]"
            />
            <Input
              type="date"
              value={filters.appliedTo ?? ''}
              onChange={(e) => onChange({ ...filters, appliedTo: e.target.value || null })}
              className="h-9 px-2 text-[13px]"
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
        </Group>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{title}</div>
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
        'nb-focus flex w-full items-center gap-2 border-2 px-1.5 py-1 text-[13px] font-semibold',
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
        <span className="h-2.5 w-2.5 flex-none border border-ink" style={{ background: swatch }} />
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && <span className="text-[11px] text-muted">{count}</span>}
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
      <span className="text-[13px] font-semibold">{label}</span>
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
