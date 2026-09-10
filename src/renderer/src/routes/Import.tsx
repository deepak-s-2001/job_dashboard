import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NewApplicationInput } from '@shared/types'
import { useAppData } from '@/lib/store'
import { api, call } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Textarea, Select } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { todayIso } from '@/lib/format'
import { parseTable } from '@/lib/csv'
import {
  COL_TARGETS,
  guessColumn,
  normUrl,
  rowToInput,
  type ColTarget,
} from '@/lib/import'

type Mode = 'links' | 'table'
type LineState = 'pending' | 'ok' | 'dup' | 'error'
interface LineResult {
  url: string
  state: LineState
  label?: string
  error?: string
}

export function Import() {
  const { apps, createAppsBulk } = useAppData()
  const navigate = useNavigate()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('links')

  const existingUrls = useMemo(
    () => new Set(apps.map((a) => normUrl(a.url)).filter(Boolean)),
    [apps],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b-3 border-ink bg-ground/95 px-6 py-4 backdrop-blur">
        <button
          onClick={() => navigate('/applications')}
          className="nb-focus border-3 border-ink bg-surface px-2 py-1 text-sm font-bold shadow-hard-sm hover:-translate-y-[1px]"
        >
          ←
        </button>
        <h1 className="font-display text-2xl font-bold">Import applications</h1>
        <div className="ml-auto flex border-3 border-ink">
          {(['links', 'table'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 text-[13px] font-bold',
                mode === m ? 'bg-ink text-ground' : 'bg-surface hover:bg-ground',
                m === 'links' && 'border-r-3 border-ink',
              )}
            >
              {m === 'links' ? 'Paste links' : 'Paste a table'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto nb-scroll p-6">
        <div className="mx-auto max-w-3xl">
          {mode === 'links' ? (
            <LinksMode
              existingUrls={existingUrls}
              createAppsBulk={createAppsBulk}
              onDone={() => navigate('/applications')}
              toastErr={(m) => toast.push('error', m)}
              toastOk={(m) => toast.push('success', m)}
            />
          ) : (
            <TableMode
              createAppsBulk={createAppsBulk}
              onDone={() => navigate('/applications')}
              toastErr={(m) => toast.push('error', m)}
              toastOk={(m) => toast.push('success', m)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Paste links ----------

function LinksMode({
  existingUrls,
  createAppsBulk,
  onDone,
  toastErr,
  toastOk,
}: {
  existingUrls: Set<string>
  createAppsBulk: (inputs: NewApplicationInput[]) => Promise<unknown>
  onDone: () => void
  toastErr: (m: string) => void
  toastOk: (m: string) => void
}) {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<LineResult[]>([])

  const urls = useMemo(
    () =>
      Array.from(
        new Set(
          text
            .split(/\n+/)
            .map((l) => l.trim())
            .filter((l) => /^https?:\/\//i.test(l)),
        ),
      ),
    [text],
  )

  async function run() {
    setRunning(true)
    const seed: LineResult[] = urls.map((url) => ({ url, state: 'pending' }))
    setResults(seed)
    const inputs: NewApplicationInput[] = []

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      if (existingUrls.has(normUrl(url))) {
        setResults((r) => r.map((x, j) => (j === i ? { ...x, state: 'dup' } : x)))
        continue
      }
      try {
        const s = await call(api.scrape.url(url))
        if (!s.company && !s.roleTitle) {
          setResults((r) =>
            r.map((x, j) =>
              j === i
                ? { ...x, state: 'error', error: "couldn't read this page — add it manually" }
                : x,
            ),
          )
          continue
        }
        inputs.push({
          url: s.url,
          sourceSite: s.sourceSite,
          company: s.company ?? '',
          roleTitle: s.roleTitle ?? '',
          location: s.location ?? null,
          workplaceType: s.workplaceType ?? null,
          employmentType: s.employmentType ?? null,
          datePosted: s.datePosted ?? null,
          salaryRange: s.salaryRange ?? null,
          jdText: s.jdText ?? '',
          dateApplied: todayIso(),
          status: 'not-applied',
          tags: [],
          notes: '',
          extraction: null,
        })
        setResults((r) =>
          r.map((x, j) =>
            j === i
              ? {
                  ...x,
                  state: 'ok',
                  label: [s.company, s.roleTitle].filter(Boolean).join(' · ') || 'Saved',
                }
              : x,
          ),
        )
      } catch (e) {
        setResults((r) =>
          r.map((x, j) =>
            j === i
              ? { ...x, state: 'error', error: e instanceof Error ? e.message : 'Failed' }
              : x,
          ),
        )
      }
    }

    if (inputs.length) {
      try {
        await createAppsBulk(inputs)
        toastOk(`Imported ${inputs.length} application${inputs.length === 1 ? '' : 's'}.`)
      } catch (e) {
        toastErr(e instanceof Error ? e.message : 'Import failed at the save step.')
      }
    } else {
      toastErr('Nothing new to import.')
    }
    setRunning(false)
  }

  const done = results.length > 0 && !running
  const okCount = results.filter((r) => r.state === 'ok').length

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted">
        One job link per line. Each is scraped for company, role and description — no AI, no
        Extract. Links already on your board are skipped.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={'https://boards.greenhouse.io/acme/jobs/123\nhttps://jobs.lever.co/northwind/…'}
        className="font-mono text-[13px]"
        disabled={running}
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={run} disabled={running || urls.length === 0}>
          {running ? <Spinner /> : `Import ${urls.length || ''} link${urls.length === 1 ? '' : 's'}`}
        </Button>
        {done && (
          <Button onClick={onDone}>{okCount > 0 ? 'Done — back to board' : 'Back'}</Button>
        )}
      </div>

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r, i) => (
            <li
              key={i}
              className="flex items-center gap-2 border-2 border-ink bg-surface px-2.5 py-1.5 text-[13px]"
            >
              <span className="flex-none font-bold">
                {r.state === 'pending' && '…'}
                {r.state === 'ok' && '✓'}
                {r.state === 'dup' && '↺'}
                {r.state === 'error' && '✗'}
              </span>
              <span className="flex-1 truncate">
                {r.state === 'ok' ? r.label : r.state === 'dup' ? 'already on your board' : r.url}
              </span>
              {r.error && <span className="flex-none text-[12px] text-accent-coral">{r.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Paste a table ----------

function TableMode({
  createAppsBulk,
  onDone,
  toastErr,
  toastOk,
}: {
  createAppsBulk: (inputs: NewApplicationInput[]) => Promise<unknown>
  onDone: () => void
  toastErr: (m: string) => void
  toastOk: (m: string) => void
}) {
  const [text, setText] = useState('')
  const [mapping, setMapping] = useState<ColTarget[]>([])
  const [saving, setSaving] = useState(false)
  const [imported, setImported] = useState<number | null>(null)

  const table = useMemo(() => parseTable(text), [text])

  function parse() {
    const t = parseTable(text)
    setMapping(t.headers.map(guessColumn))
    setImported(null)
  }

  const preview = table.rows.slice(0, 8)
  const willImport = useMemo(
    () => table.rows.map((row) => rowToInput(row, mapping)).filter((x): x is NewApplicationInput => !!x),
    [table.rows, mapping],
  )
  const skipped = table.rows.length - willImport.length

  async function run() {
    setSaving(true)
    try {
      await createAppsBulk(willImport)
      setImported(willImport.length)
      toastOk(`Imported ${willImport.length} application${willImport.length === 1 ? '' : 's'}.`)
    } catch (e) {
      toastErr(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted">
        Paste rows from a spreadsheet, or a CSV export from Huntr / Teal. The first row is
        treated as headers. Match each column below, then import — no scraping, no AI.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={'Company,Job Title,URL,Status,Date Applied\nAcme,Senior DSP Engineer,https://…,Interviewing,2026-09-01'}
        className="font-mono text-[12px]"
      />
      <Button onClick={parse} disabled={!text.trim()}>
        Parse table
      </Button>

      {table.headers.length > 0 && mapping.length === table.headers.length && (
        <>
          <div className="overflow-x-auto nb-scroll border-3 border-ink">
            <table className="min-w-full text-[12px]">
              <thead>
                <tr className="border-b-3 border-ink bg-ground">
                  {table.headers.map((h, i) => (
                    <th key={i} className="border-r-2 border-ink/40 px-2 py-1.5 text-left align-top last:border-r-0">
                      <div className="mb-1 font-bold">{h || <span className="text-muted">(col {i + 1})</span>}</div>
                      <Select
                        size="sm"
                        ariaLabel={`Map column ${i + 1}`}
                        value={mapping[i]}
                        onChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? (v as ColTarget) : x)))}
                        options={COL_TARGETS}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri} className="border-b border-ink/20 last:border-b-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="border-r border-ink/15 px-2 py-1 last:border-r-0">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <Button variant="primary" onClick={run} disabled={saving || willImport.length === 0}>
              {saving ? <Spinner /> : `Import ${willImport.length} row${willImport.length === 1 ? '' : 's'}`}
            </Button>
            {skipped > 0 && <span>{skipped} row{skipped === 1 ? '' : 's'} skipped (no company or role)</span>}
            {imported != null && <Button onClick={onDone}>Done — back to board</Button>}
          </div>
        </>
      )}
    </div>
  )
}
