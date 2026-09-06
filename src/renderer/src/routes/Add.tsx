import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '@/lib/store'
import { api, call } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Fieldset } from '@/components/ui/Field'
import { Spinner, Divider } from '@/components/ui/misc'
import { TagInput } from '@/components/TagInput'
import { StatusControl } from '@/components/StatusControl'
import { todayIso } from '@/lib/format'
import {
  EMPLOYMENT_TYPES,
  WORKPLACE_TYPES,
  type ApplicationStatus,
  type EmploymentType,
  type ExtractionResult,
  type ScrapedJob,
  type SourceSite,
  type WorkplaceType,
} from '@shared/types'

interface FormState {
  url: string
  sourceSite: SourceSite
  company: string
  roleTitle: string
  location: string
  workplaceType: WorkplaceType | ''
  employmentType: EmploymentType | ''
  datePosted: string
  salaryRange: string
  jdText: string
  dateApplied: string
  status: ApplicationStatus
  tags: string[]
  notes: string
}

function fromScrape(s: ScrapedJob): FormState {
  return {
    url: s.url,
    sourceSite: s.sourceSite,
    company: s.company ?? '',
    roleTitle: s.roleTitle ?? '',
    location: s.location ?? '',
    workplaceType: s.workplaceType ?? '',
    employmentType: s.employmentType ?? '',
    datePosted: s.datePosted ?? '',
    salaryRange: s.salaryRange ?? '',
    jdText: s.jdText,
    dateApplied: todayIso(),
    status: 'applied',
    tags: [],
    notes: '',
  }
}

export function AddApplication() {
  const navigate = useNavigate()
  const toast = useToast()
  const { tags, settings, createApp, refreshMeta } = useAppData()

  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<'input' | 'review'>('input')
  const [scraping, setScraping] = useState(false)
  const [scrapeNote, setScrapeNote] = useState('')
  const [needsPaste, setNeedsPaste] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState<null | 'ai' | 'plain'>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f))

  async function fetchUrl() {
    if (!url.trim()) return
    setScraping(true)
    try {
      const scraped = await call(api.scrape.url(url.trim()))
      setForm(fromScrape(scraped))
      setScrapeNote(scraped.note)
      setNeedsPaste(scraped.needsManualPaste)
      setPhase('review')
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not read that link.')
    } finally {
      setScraping(false)
    }
  }

  function skipToManual() {
    setForm({ ...fromScrape({ ...BLANK_SCRAPE, url: url.trim() }) })
    setScrapeNote('Enter the details yourself.')
    setNeedsPaste(true)
    setPhase('review')
  }

  async function reExtractPaste() {
    if (!form) return
    // re-run the scrape pipeline against pasted text to normalize it
    const scraped = await call(api.scrape.url(form.url, form.jdText))
    setNeedsPaste(scraped.needsManualPaste)
    setScrapeNote(scraped.note)
  }

  async function save(withAi: boolean) {
    if (!form) return
    if (!form.company.trim() || !form.roleTitle.trim()) {
      toast.push('error', 'Company and role title are required.')
      return
    }
    if (form.jdText.trim().length < 40) {
      toast.push('error', 'Add the job description text first.')
      return
    }
    setSaving(withAi ? 'ai' : 'plain')
    try {
      let extraction: ExtractionResult | null = null
      if (withAi) {
        if (!settings.hasApiKey) {
          toast.push('error', 'Add your Anthropic API key in Settings to use Extract.')
          setSaving(null)
          return
        }
        extraction = await call(
          api.extract.jd({
            company: form.company,
            roleTitle: form.roleTitle,
            jdText: form.jdText,
          }),
        )
        await refreshMeta()
      }
      const created = await createApp({
        url: form.url,
        sourceSite: form.sourceSite,
        company: form.company.trim(),
        roleTitle: form.roleTitle.trim(),
        location: form.location.trim() || null,
        workplaceType: form.workplaceType || null,
        employmentType: form.employmentType || null,
        datePosted: form.datePosted || null,
        salaryRange: form.salaryRange.trim() || null,
        jdText: form.jdText.trim(),
        dateApplied: form.dateApplied,
        status: form.status,
        tags: form.tags,
        notes: form.notes.trim(),
        extraction,
      })
      toast.push('success', withAi ? 'Saved with skills & insights.' : 'Saved.')
      navigate(`/app/${created.id}?attach=1`)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => (phase === 'review' ? setPhase('input') : navigate('/'))}
          className="nb-focus border-3 border-ink bg-surface px-2 py-1 text-sm font-bold shadow-hard-sm hover:-translate-y-[1px]"
        >
          ←
        </button>
        <h1 className="font-display text-3xl font-bold">Add application</h1>
      </div>

      {phase === 'input' && (
        <Card className="p-5">
          <Fieldset label="Job posting link" hint="Greenhouse, Lever, Ashby, Workday, LinkedIn, or any job page">
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUrl()}
                placeholder="https://…"
                autoFocus
              />
              <Button variant="primary" onClick={fetchUrl} disabled={!url.trim() || scraping}>
                {scraping ? <Spinner className="border-ground border-t-transparent" /> : 'Fetch'}
              </Button>
            </div>
          </Fieldset>
          {scraping && (
            <p className="mt-3 text-sm text-muted">
              Opening the page and reading the job details… this can take a few seconds.
            </p>
          )}
          <Divider label="or" />
          <button
            onClick={skipToManual}
            className="text-sm font-semibold text-muted underline hover:text-ink"
          >
            Enter everything manually
          </button>
        </Card>
      )}

      {phase === 'review' && form && (
        <div className="space-y-4">
          <div
            className={
              'border-3 border-ink rounded px-3 py-2 text-[13px] font-semibold ' +
              (needsPaste ? 'bg-accent-coral' : 'bg-accent-lime')
            }
          >
            {scrapeNote}
          </div>

          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Fieldset label="Company *">
                <Input value={form.company} onChange={(e) => set('company', e.target.value)} />
              </Fieldset>
              <Fieldset label="Role title *">
                <Input value={form.roleTitle} onChange={(e) => set('roleTitle', e.target.value)} />
              </Fieldset>
              <Fieldset label="Location">
                <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
              </Fieldset>
              <Fieldset label="Salary range">
                <Input value={form.salaryRange} onChange={(e) => set('salaryRange', e.target.value)} />
              </Fieldset>
              <Fieldset label="Employment type">
                <Select
                  value={form.employmentType}
                  onChange={(e) => set('employmentType', e.target.value as EmploymentType | '')}
                >
                  <option value="">—</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Fieldset>
              <Fieldset label="Workplace">
                <Select
                  value={form.workplaceType}
                  onChange={(e) => set('workplaceType', e.target.value as WorkplaceType | '')}
                >
                  <option value="">—</option>
                  {WORKPLACE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Fieldset>
              <Fieldset label="Date posted">
                <Input
                  type="date"
                  value={form.datePosted}
                  onChange={(e) => set('datePosted', e.target.value)}
                />
              </Fieldset>
              <Fieldset label="Date applied">
                <Input
                  type="date"
                  value={form.dateApplied}
                  onChange={(e) => set('dateApplied', e.target.value)}
                />
              </Fieldset>
            </div>

            <Fieldset label="Status">
              <StatusControl value={form.status} onChange={(s) => set('status', s)} />
            </Fieldset>

            <Fieldset label="Tags">
              <TagInput
                value={form.tags}
                onChange={(t) => set('tags', t)}
                suggestions={tags.map((t) => t.name)}
              />
            </Fieldset>

            <Fieldset
              label="Job description"
              hint={`${form.jdText.trim().length.toLocaleString()} chars`}
            >
              <Textarea
                value={form.jdText}
                onChange={(e) => set('jdText', e.target.value)}
                onBlur={() => needsPaste && void reExtractPaste()}
                rows={needsPaste ? 12 : 7}
                placeholder="Paste the full job description here…"
              />
            </Fieldset>

            <Fieldset label="Notes" hint="private to you">
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                placeholder="Referral, recruiter name, why you applied…"
              />
            </Fieldset>
          </Card>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-3 border-ink bg-surface rounded p-3 shadow-hard">
            <Button
              variant="primary"
              onClick={() => save(true)}
              disabled={saving !== null}
              title={settings.hasApiKey ? undefined : 'Add an API key in Settings'}
            >
              {saving === 'ai' ? (
                <>
                  <Spinner className="border-ground border-t-transparent" /> Extracting…
                </>
              ) : (
                <>✦ Extract &amp; Save</>
              )}
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={saving !== null}>
              {saving === 'plain' ? <Spinner /> : 'Save without AI'}
            </Button>
            <span className="text-[12px] text-muted">
              Extract runs one {settings.extractionModel.replace('claude-', '')} call
              {settings.hasApiKey ? '' : ' — needs an API key'}. You can also run it later.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const BLANK_SCRAPE: ScrapedJob = {
  url: '',
  sourceSite: 'generic',
  company: null,
  roleTitle: null,
  location: null,
  workplaceType: null,
  employmentType: null,
  datePosted: null,
  salaryRange: null,
  jdText: '',
  needsManualPaste: true,
  note: '',
}
