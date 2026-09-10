import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Application } from '@shared/types'
import {
  EMPLOYMENT_TYPES,
  WORKPLACE_TYPES,
  type EmploymentType,
  type SalaryPeriod,
  type WorkplaceType,
} from '@shared/types'
import { api, call } from '@/lib/api'
import { useAppData } from '@/lib/store'
import { useView } from '@/lib/view'
import { useFilteredApps, sortApps } from '@/lib/filter'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'
import { Button } from '@/components/ui/Button'
import { Input, Select, Fieldset } from '@/components/ui/Field'
import { Spinner, EmptyState, Divider } from '@/components/ui/misc'
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs'
import { ResumePane } from '@/components/ResumePane'
import { JobPrompt } from '@/components/JobPrompt'
import { JobNetwork } from '@/components/JobNetwork'
import { JobTodos } from '@/components/JobTodos'
import { JobInterviews } from '@/components/JobInterviews'
import { NotesEditor } from '@/components/NotesEditor'
import { LocationInput } from '@/components/LocationInput'
import { DateField } from '@/components/ui/DatePicker'
import { contactsForJob } from '@/lib/company'
import { SkillGroup, InsightList } from '@/components/SkillGroup'
import { WorkdaySkillsBox } from '@/components/WorkdaySkillsBox'
import { StatusControl } from '@/components/StatusControl'
import { TagInput } from '@/components/TagInput'
import { ACCENT_HEX, SOURCE_LABEL, STATUS_HEX, fmtDate, initials, statusLabel, titleCase, todayIso } from '@/lib/format'

export function Detail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const { apps, contacts, todos, tags, settings, refreshMeta, refresh } = useAppData()
  const { query, filters, sort, narrowed } = useView()

  const [app, setApp] = useState<Application | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('jd')
  const [extracting, setExtracting] = useState(false)

  // The working set to page through: the dashboard's current search/filter
  // results when this job is part of them, otherwise every job in sort order.
  const results = useFilteredApps(apps, query, filters, sort)
  const allSorted = useMemo(() => sortApps(apps, sort), [apps, sort])
  const nav = useMemo(() => {
    const inResults = results.some((a) => a.id === id)
    const list = inResults ? results : allSorted
    const i = list.findIndex((a) => a.id === id)
    return {
      list,
      index: i,
      inNarrowed: inResults && narrowed,
      prev: i > 0 ? list[i - 1] : null,
      next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
    }
  }, [results, allSorted, id, narrowed])

  const goPrev = useCallback(() => {
    if (nav.prev) navigate(`/app/${nav.prev.id}`)
  }, [nav.prev, navigate])
  const goNext = useCallback(() => {
    if (nav.next) navigate(`/app/${nav.next.id}`)
  }, [nav.next, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName) || t?.isContentEditable) return
      if (e.key === '[' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault()
        goPrev()
      } else if (e.key === ']' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  const load = useCallback(async () => {
    if (!id) return
    try {
      setApp(await call(api.apps.get(id)))
    } catch {
      setNotFound(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const patch = useCallback(
    async (p: Partial<Application>) => {
      if (!id) return
      const updated = await call(api.apps.update(id, p))
      setApp(updated)
      void refresh()
    },
    [id, refresh],
  )

  async function runExtraction() {
    if (!app) return
    if (!settings.hasApiKey) {
      toast.push('error', 'Add your Anthropic API key in Settings first.')
      return
    }
    setExtracting(true)
    try {
      await call(
        api.extract.jd({
          company: app.company,
          roleTitle: app.roleTitle,
          jdText: app.jdText,
          applicationId: app.id,
        }),
      )
      await Promise.all([load(), refreshMeta()])
      toast.push('success', 'Extraction updated.')
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Extraction failed.')
    } finally {
      setExtracting(false)
    }
  }

  async function del() {
    if (!app) return
    const yes = await confirm({
      title: 'Delete this application?',
      body: (
        <>
          <strong>{app.roleTitle}</strong> at <strong>{app.company}</strong> and its{' '}
          {app.resumes.length} attached resume{app.resumes.length === 1 ? '' : 's'} will be
          removed. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!yes) return
    await call(api.apps.remove(app.id))
    await refresh()
    navigate('/applications')
  }

  if (notFound) {
    return (
      <div className="p-8">
        <EmptyState emoji="🫥" title="That application is gone"
          action={<Button onClick={() => navigate('/applications')}>Back to applications</Button>} />
      </div>
    )
  }
  if (!app) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted">
        <Spinner /> Loading…
      </div>
    )
  }

  const accent = ACCENT_HEX[app.accent]
  const skillTotal =
    app.skills.required.length + app.skills.preferred.length + app.skills.industry.length
  const net = contactsForJob(contacts, app)
  const netCount = net.matched.length + net.linked.length
  const openTodoCount = todos.filter((t) => t.applicationId === app.id && !t.done).length
  const showInterviews =
    app.interviews.length > 0 || app.status === 'interviewing' || app.status === 'offer'

  return (
    <div className="flex h-full flex-col">
      <header className="flex-none border-b-3 border-ink bg-ground px-5 py-3">
        <div className="mb-2.5 flex items-center gap-2">
          <button
            onClick={() => navigate('/applications')}
            className="nb-focus flex items-center gap-1.5 border-3 border-ink bg-surface px-2.5 py-1 text-[13px] font-bold shadow-hard-sm hover:-translate-y-[1px]"
          >
            ← All applications
          </button>

          {nav.index >= 0 && nav.list.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                disabled={!nav.prev}
                title="Previous  ·  [ or Alt+←"
                className="nb-focus flex h-8 w-8 items-center justify-center border-3 border-ink bg-surface font-bold shadow-hard-sm hover:-translate-y-[1px] disabled:opacity-35 disabled:shadow-none disabled:hover:translate-y-0"
              >
                ‹
              </button>
              <span
                className="border-3 border-ink bg-surface px-2.5 py-1 text-[13px] font-bold tabular-nums"
                title={nav.inNarrowed ? 'Position within your current search / filter' : 'Position in all applications'}
              >
                {nav.index + 1}
                <span className="text-muted"> / {nav.list.length}</span>
              </span>
              <button
                onClick={goNext}
                disabled={!nav.next}
                title="Next  ·  ] or Alt+→"
                className="nb-focus flex h-8 w-8 items-center justify-center border-3 border-ink bg-surface font-bold shadow-hard-sm hover:-translate-y-[1px] disabled:opacity-35 disabled:shadow-none disabled:hover:translate-y-0"
              >
                ›
              </button>
              {nav.inNarrowed && (
                <span className="ml-1 border-2 border-ink bg-accent-yellow px-1.5 py-0.5 text-[11px] font-bold uppercase">
                  filtered
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 flex-none items-center justify-center border-3 border-ink rounded font-display text-base font-bold"
            style={{ background: accent }}
          >
            {initials(app.company)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[22px] font-bold leading-tight">
              {app.roleTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-semibold text-muted">
              <span>{app.company}</span>
              {app.location && <span>· {app.location}</span>}
              <span>
                ·{' '}
                {app.status === 'not-applied'
                  ? `added ${fmtDate(app.createdAt)}`
                  : `applied ${fmtDate(app.dateApplied)}`}
              </span>
              {app.url && (
                <>
                  <span>·</span>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-ink"
                  >
                    {SOURCE_LABEL[app.sourceSite] ?? 'link'} ↗
                  </a>
                </>
              )}
            </div>
            <div className="mt-2.5">
              <StatusControl
                value={app.status}
                onChange={(s) =>
                  patch(
                    app.status === 'not-applied' && s !== 'not-applied'
                      ? { status: s, dateApplied: todayIso() }
                      : { status: s },
                  )
                }
                size="sm"
              />
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            {!app.extracted && (
              <Button variant="primary" onClick={runExtraction} disabled={extracting}>
                {extracting ? (
                  <>
                    <Spinner className="border-ground border-t-transparent" /> Extracting…
                  </>
                ) : (
                  '✦ Extract'
                )}
              </Button>
            )}
            <Button variant="danger" onClick={del}>
              Delete
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 border-b-3 border-ink p-4 lg:border-b-0 lg:border-r-3">
          <ResumePane app={app} autoAttach={params.get('attach') === '1'} onChanged={load} />
        </div>

        <div className="flex min-h-0 flex-col">
          <Tabs value={tab} onChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabList>
              <Tab value="jd">Description</Tab>
              <Tab value="skills" count={skillTotal}>
                Skills
              </Tab>
              <Tab value="insights" count={app.companyInsights.length}>
                Insights
              </Tab>
              <Tab value="tips" count={app.tailoringTips.length}>
                Tips
              </Tab>
              <Tab value="network" count={netCount}>
                Network
              </Tab>
              {showInterviews && (
                <Tab value="interviews" count={app.interviews.length}>
                  Interviews
                </Tab>
              )}
              <Tab value="todos" count={openTodoCount}>
                To-dos
              </Tab>
              <Tab value="prompt">Prompt</Tab>
              <Tab value="notes">Notes</Tab>
              <Tab value="details">Details</Tab>
            </TabList>

            <div className="min-h-0 flex-1 overflow-y-auto nb-scroll p-5">
              <TabPanel value="jd" className="space-y-4">
                {app.jdSummary && (
                  <p className="border-l-4 border-ink bg-ground px-3.5 py-2.5 text-[15px] font-medium leading-relaxed">
                    {app.jdSummary}
                  </p>
                )}
                {app.responsibilities.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-display text-base font-bold uppercase tracking-wide">
                      Responsibilities
                    </h4>
                    <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
                      {app.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Divider label="full text" />
                <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink/90">
                  {app.jdText}
                </pre>
              </TabPanel>

              <TabPanel value="skills" className="space-y-6">
                {app.extracted ? (
                  <>
                    <SkillGroup title="Required" skills={app.skills.required} accent="#ff90e8" />
                    <SkillGroup title="Preferred" skills={app.skills.preferred} accent="#ffc900" />
                    <SkillGroup
                      title="Industry / ATS keywords"
                      skills={app.skills.industry}
                      accent="#6c8cff"
                    />
                    {app.seniority && (
                      <p className="text-[14px] text-muted">
                        Seniority read: <strong className="text-ink">{app.seniority}</strong>
                      </p>
                    )}
                    <WorkdaySkillsBox skills={app.skills} />
                  </>
                ) : (
                  <ExtractCta onRun={runExtraction} busy={extracting} hasKey={settings.hasApiKey} />
                )}
              </TabPanel>

              <TabPanel value="insights">
                <p className="mb-3 text-[14px] text-muted">
                  Things to keep in mind when you write the resume for this one.
                </p>
                {app.extracted ? (
                  <InsightList items={app.companyInsights} tone="yellow" accent="#23a094" />
                ) : (
                  <ExtractCta onRun={runExtraction} busy={extracting} hasKey={settings.hasApiKey} />
                )}
              </TabPanel>

              <TabPanel value="tips">
                <p className="mb-3 text-[14px] text-muted">
                  Concrete phrasing and emphasis moves for a resume aimed at this JD.
                </p>
                {app.extracted ? (
                  <InsightList items={app.tailoringTips} tone="pink" accent="#ff90e8" />
                ) : (
                  <ExtractCta onRun={runExtraction} busy={extracting} hasKey={settings.hasApiKey} />
                )}
              </TabPanel>

              <TabPanel value="network">
                <p className="mb-3 text-[14px] text-muted">
                  People who could refer you here. Anyone in your Network whose company matches
                  shows up automatically.
                </p>
                <JobNetwork app={app} />
              </TabPanel>

              {showInterviews && (
                <TabPanel value="interviews">
                  <p className="mb-3 text-[14px] text-muted">
                    Each round, who you're meeting, and what to prep. Upcoming rounds show on the
                    Overview.
                  </p>
                  <JobInterviews app={app} onPatch={patch} />
                </TabPanel>
              )}

              <TabPanel value="todos">
                <p className="mb-3 text-[14px] text-muted">
                  Things to do for this job. They also show on the main To-dos list.
                </p>
                <JobTodos app={app} />
              </TabPanel>

              <TabPanel value="prompt">
                <JobPrompt app={app} />
              </TabPanel>

              <TabPanel value="notes">
                <NotesEditor
                  value={app.notes}
                  onSave={(v) => patch({ notes: v })}
                  placeholder="Referral, recruiter, salary discussion, interview notes…"
                />
              </TabPanel>

              <TabPanel value="details">
                <DetailsForm app={app} tags={tags.map((t) => t.name)} onPatch={patch} />
                {app.extracted && (
                  <div className="mt-5 border-t-2 border-dashed border-ink/60 pt-3">
                    <Button onClick={runExtraction} disabled={extracting}>
                      {extracting ? <Spinner /> : '↻ Re-run extraction'}
                    </Button>
                    <p className="mt-1.5 text-[12px] text-muted">
                      Extracted with {app.extractionModel?.replace('claude-', '')} on{' '}
                      {fmtDate(app.extractedAt)}. Overwrites skills, insights &amp; tips.
                    </p>
                  </div>
                )}
              </TabPanel>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function ExtractCta({
  onRun,
  busy,
  hasKey,
}: {
  onRun: () => void
  busy: boolean
  hasKey: boolean
}) {
  return (
    <div className="flex flex-col items-start gap-2 border-3 border-dashed border-ink rounded bg-ground p-4">
      <p className="text-sm font-semibold">Not extracted yet</p>
      <p className="text-[13px] text-muted">
        One {hasKey ? '' : '(needs an API key) '}Claude call pulls skills, company insights and
        tailoring tips from the job description.
      </p>
      <Button variant="primary" onClick={onRun} disabled={busy}>
        {busy ? (
          <>
            <Spinner className="border-ground border-t-transparent" /> Extracting…
          </>
        ) : (
          '✦ Extract now'
        )}
      </Button>
    </div>
  )
}

function DetailsForm({
  app,
  tags,
  onPatch,
}: {
  app: Application
  tags: string[]
  onPatch: (p: Partial<Application>) => Promise<void>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Company">
        <Input defaultValue={app.company} onBlur={(e) => commit(e.target.value, app.company, (v) => onPatch({ company: v }))} />
      </Field>
      <Field label="Role title">
        <Input defaultValue={app.roleTitle} onBlur={(e) => commit(e.target.value, app.roleTitle, (v) => onPatch({ roleTitle: v }))} />
      </Field>
      <Field label="Location">
        <LocationInput
          value={app.location ?? ''}
          onBlur={(v) => commit(v, app.location ?? '', (x) => onPatch({ location: x || null }))}
        />
      </Field>
      <Field label="Salary range">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            placeholder="min"
            defaultValue={app.salaryMin ?? ''}
            key={`min${app.id}${app.salaryMin}`}
            onBlur={(e) =>
              onPatch({ salaryMin: e.target.value ? Number(e.target.value) : null })
            }
          />
          <span className="font-bold text-muted">–</span>
          <Input
            type="number"
            placeholder="max"
            defaultValue={app.salaryMax ?? ''}
            key={`max${app.id}${app.salaryMax}`}
            onBlur={(e) =>
              onPatch({ salaryMax: e.target.value ? Number(e.target.value) : null })
            }
          />
          <Select
            ariaLabel="Pay period"
            value={app.salaryPeriod ?? ''}
            onChange={(v) => onPatch({ salaryPeriod: (v || null) as SalaryPeriod | null })}
            options={[
              { value: '', label: '—' },
              { value: 'year', label: '/ yr' },
              { value: 'hour', label: '/ hr' },
            ]}
          />
        </div>
      </Field>
      <Field label="Employment type">
        <Select
          ariaLabel="Employment type"
          value={app.employmentType ?? ''}
          onChange={(v) => onPatch({ employmentType: (v || null) as EmploymentType | null })}
          options={[
            { value: '', label: '—' },
            ...EMPLOYMENT_TYPES.map((t) => ({ value: t, label: titleCase(t) })),
          ]}
        />
      </Field>
      <Field label="Workplace">
        <Select
          ariaLabel="Workplace"
          value={app.workplaceType ?? ''}
          onChange={(v) => onPatch({ workplaceType: (v || null) as WorkplaceType | null })}
          options={[
            { value: '', label: '—' },
            ...WORKPLACE_TYPES.map((t) => ({ value: t, label: titleCase(t) })),
          ]}
        />
      </Field>
      <Field label="Date posted">
        <DateField value={app.datePosted ?? null} onChange={(v) => onPatch({ datePosted: v })} />
      </Field>
      <Field label="Date applied">
        <DateField value={app.dateApplied || null} onChange={(v) => onPatch({ dateApplied: v ?? '' })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Tags">
          <TagInput value={app.tags} onChange={(t) => onPatch({ tags: t })} suggestions={tags} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Job link">
          <Input defaultValue={app.url} onBlur={(e) => commit(e.target.value, app.url, (v) => onPatch({ url: v }))} />
        </Field>
      </div>
      {app.statusHistory && app.statusHistory.length > 1 && (
        <div className="sm:col-span-2">
          <Fieldset label="Status history">
            <ol className="flex flex-wrap items-center gap-1.5 text-[12px]">
              {app.statusHistory.map((h, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted">→</span>}
                  <span
                    className="border-2 border-ink px-1.5 py-0.5 font-bold uppercase"
                    style={{ background: STATUS_HEX[h.status] }}
                  >
                    {statusLabel(h.status)}
                  </span>
                  <span className="text-muted">{fmtDate(h.at)}</span>
                </li>
              ))}
            </ol>
          </Fieldset>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Fieldset label={label}>{children}</Fieldset>
}

function commit(next: string, prev: string, apply: (v: string) => void) {
  if (next.trim() !== prev) apply(next.trim())
}
