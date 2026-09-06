import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Application } from '@shared/types'
import {
  EMPLOYMENT_TYPES,
  WORKPLACE_TYPES,
  type EmploymentType,
  type WorkplaceType,
} from '@shared/types'
import { api, call } from '@/lib/api'
import { useAppData } from '@/lib/store'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea, Fieldset } from '@/components/ui/Field'
import { Spinner, EmptyState, Divider } from '@/components/ui/misc'
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs'
import { ResumePane } from '@/components/ResumePane'
import { SkillGroup, InsightList } from '@/components/SkillGroup'
import { StatusControl } from '@/components/StatusControl'
import { TagInput } from '@/components/TagInput'
import { ACCENT_HEX, SOURCE_LABEL, fmtDate, initials } from '@/lib/format'

export function Detail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const { tags, settings, refreshMeta, refresh } = useAppData()

  const [app, setApp] = useState<Application | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('jd')
  const [extracting, setExtracting] = useState(false)

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
    if (!confirm(`Delete the ${app.company} application and its resumes? This cannot be undone.`))
      return
    await call(api.apps.remove(app.id))
    await refresh()
    navigate('/')
  }

  if (notFound) {
    return (
      <div className="p-8">
        <EmptyState emoji="🫥" title="That application is gone"
          action={<Button onClick={() => navigate('/')}>Back to dashboard</Button>} />
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex-none border-b-3 border-ink bg-ground px-5 py-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/')}
            className="nb-focus mt-0.5 border-3 border-ink bg-surface px-2 py-1 text-sm font-bold shadow-hard-sm hover:-translate-y-[1px]"
          >
            ←
          </button>
          <div
            className="flex h-11 w-11 flex-none items-center justify-center border-3 border-ink rounded font-display text-sm font-bold"
            style={{ background: accent }}
          >
            {initials(app.company)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-bold leading-tight">
              {app.roleTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-semibold text-muted">
              <span>{app.company}</span>
              {app.location && <span>· {app.location}</span>}
              <span>· applied {fmtDate(app.dateApplied)}</span>
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
        <div className="mt-2.5 pl-[3.7rem]">
          <StatusControl value={app.status} onChange={(s) => patch({ status: s })} size="sm" />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 border-b-3 border-ink p-4 lg:border-b-0 lg:border-r-3">
          <ResumePane app={app} autoAttach={params.get('attach') === '1'} onChanged={load} />
        </div>

        <div className="flex min-h-0 flex-col">
          <Tabs value={tab} onChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabList>
              <Tab value="jd">Job description</Tab>
              <Tab value="skills" count={skillTotal}>
                Skills
              </Tab>
              <Tab value="insights" count={app.companyInsights.length}>
                Insights
              </Tab>
              <Tab value="tips" count={app.tailoringTips.length}>
                Tips
              </Tab>
              <Tab value="notes">Notes</Tab>
              <Tab value="details">Details</Tab>
            </TabList>

            <div className="min-h-0 flex-1 overflow-y-auto nb-scroll p-4">
              <TabPanel value="jd" className="space-y-3">
                {app.jdSummary && (
                  <p className="border-l-4 border-ink bg-ground px-3 py-2 text-sm font-medium leading-relaxed">
                    {app.jdSummary}
                  </p>
                )}
                {app.responsibilities.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 font-display text-sm font-bold uppercase tracking-wide">
                      Responsibilities
                    </h4>
                    <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
                      {app.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Divider label="full text" />
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink/90">
                  {app.jdText}
                </pre>
              </TabPanel>

              <TabPanel value="skills" className="space-y-5">
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
                      <p className="text-[13px] text-muted">
                        Seniority read: <strong className="text-ink">{app.seniority}</strong>
                      </p>
                    )}
                  </>
                ) : (
                  <ExtractCta onRun={runExtraction} busy={extracting} hasKey={settings.hasApiKey} />
                )}
              </TabPanel>

              <TabPanel value="insights">
                {app.extracted ? (
                  <InsightList items={app.companyInsights} emoji="💡" />
                ) : (
                  <ExtractCta onRun={runExtraction} busy={extracting} hasKey={settings.hasApiKey} />
                )}
              </TabPanel>

              <TabPanel value="tips">
                {app.extracted ? (
                  <InsightList items={app.tailoringTips} emoji="✏️" />
                ) : (
                  <ExtractCta onRun={runExtraction} busy={extracting} hasKey={settings.hasApiKey} />
                )}
              </TabPanel>

              <TabPanel value="notes">
                <Textarea
                  defaultValue={app.notes}
                  rows={12}
                  placeholder="Referral, recruiter, salary discussion, interview notes…"
                  onBlur={(e) => {
                    if (e.target.value !== app.notes) void patch({ notes: e.target.value })
                  }}
                />
                <p className="mt-1.5 text-[11px] text-muted">Saved when you click away.</p>
              </TabPanel>

              <TabPanel value="details">
                <DetailsForm app={app} tags={tags.map((t) => t.name)} onPatch={patch} />
                {app.extracted && (
                  <div className="mt-5 border-t-2 border-dashed border-ink/30 pt-3">
                    <Button onClick={runExtraction} disabled={extracting}>
                      {extracting ? <Spinner /> : '↻ Re-run extraction'}
                    </Button>
                    <p className="mt-1.5 text-[11px] text-muted">
                      Extracted with {app.extractionModel?.replace('claude-', '')} on{' '}
                      {fmtDate(app.extractedAt)}. Overwrites skills, insights & tips.
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
        <Input defaultValue={app.location ?? ''} onBlur={(e) => commit(e.target.value, app.location ?? '', (v) => onPatch({ location: v || null }))} />
      </Field>
      <Field label="Salary range">
        <Input defaultValue={app.salaryRange ?? ''} onBlur={(e) => commit(e.target.value, app.salaryRange ?? '', (v) => onPatch({ salaryRange: v || null }))} />
      </Field>
      <Field label="Employment type">
        <Select
          value={app.employmentType ?? ''}
          onChange={(e) => onPatch({ employmentType: (e.target.value || null) as EmploymentType | null })}
        >
          <option value="">—</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Workplace">
        <Select
          value={app.workplaceType ?? ''}
          onChange={(e) => onPatch({ workplaceType: (e.target.value || null) as WorkplaceType | null })}
        >
          <option value="">—</option>
          {WORKPLACE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Date posted">
        <Input type="date" defaultValue={app.datePosted ?? ''} onBlur={(e) => commit(e.target.value, app.datePosted ?? '', (v) => onPatch({ datePosted: v || null }))} />
      </Field>
      <Field label="Date applied">
        <Input type="date" defaultValue={app.dateApplied} onBlur={(e) => commit(e.target.value, app.dateApplied, (v) => onPatch({ dateApplied: v }))} />
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
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Fieldset label={label}>{children}</Fieldset>
}

function commit(next: string, prev: string, apply: (v: string) => void) {
  if (next.trim() !== prev) apply(next.trim())
}
