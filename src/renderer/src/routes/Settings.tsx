import { useEffect, useState } from 'react'
import { useAppData } from '@/lib/store'
import { api, call } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Fieldset, Select } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/misc'
import { money } from '@/lib/format'
import { useCopy } from '@/lib/useCopy'
import type { EducationEntry, ExtractionModel, UserProfile } from '@shared/types'

const MODELS: { id: ExtractionModel; name: string; blurb: string }[] = [
  {
    id: 'claude-haiku-4-5',
    name: 'Haiku 4.5',
    blurb: 'Fast and cheap (~$0.007/job). Great for skills + summary.',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Sonnet 5',
    blurb: 'Richer company insights & tailoring tips (~$0.015/job).',
  },
]

export function Settings() {
  const { settings, usage, refreshMeta } = useAppData()
  const toast = useToast()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'export'>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void call(api.system.version()).then(setVersion).catch(() => {})
  }, [])

  async function saveKey() {
    setBusy('save')
    try {
      await call(api.apiKey.set(key))
      setKey('')
      await refreshMeta()
      toast.push('success', 'API key saved.')
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not save the key.')
    } finally {
      setBusy(null)
    }
  }

  async function testKey() {
    setBusy('test')
    try {
      await call(api.apiKey.test(key || undefined))
      toast.push('success', 'Key works.')
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Key test failed.')
    } finally {
      setBusy(null)
    }
  }

  async function setModel(id: ExtractionModel) {
    try {
      await call(api.settings.setModel(id))
      await refreshMeta()
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not change model.')
    }
  }

  async function clearKey() {
    await call(api.apiKey.set(''))
    await refreshMeta()
    toast.push('info', 'API key removed.')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6 md:p-8">
      <h1 className="text-3xl">Settings</h1>

      <ProfileCard />
      <ExtensionCard />

      <Card className="p-5">
        <h2 className="text-lg">Anthropic API key</h2>
        <p className="mt-1 text-sm text-muted">
          Used only when you press <strong>Extract</strong>. Stored encrypted on this machine,
          never in the database, never sent anywhere except Anthropic.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span
            className={
              'inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-[12px] font-bold ' +
              (settings.hasApiKey ? 'bg-accent-lime' : 'bg-accent-coral')
            }
          >
            {settings.hasApiKey ? '✓ key set' : 'no key'}
          </span>
          {settings.hasApiKey && (
            <button
              onClick={clearKey}
              className="text-[12px] font-semibold text-muted underline hover:text-ink"
            >
              remove
            </button>
          )}
        </div>
        <Fieldset className="mt-3" label="Paste a new key">
          <Input
            type="password"
            placeholder="sk-ant-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Fieldset>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={saveKey} disabled={!key.trim() || busy !== null}>
            {busy === 'save' ? <Spinner className="border-ground border-t-transparent" /> : 'Save key'}
          </Button>
          <Button onClick={testKey} disabled={busy !== null || (!key.trim() && !settings.hasApiKey)}>
            {busy === 'test' ? <Spinner /> : 'Test'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg">Extraction model</h2>
        <div className="mt-3 grid gap-2">
          {MODELS.map((m) => {
            const active = settings.extractionModel === m.id
            return (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={
                  'nb-focus flex items-start gap-3 border-3 border-ink rounded p-3 text-left transition-transform ' +
                  (active ? 'bg-accent-yellow shadow-hard' : 'bg-surface hover:-translate-y-[1px] hover:shadow-hard')
                }
              >
                <span
                  className={
                    'mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 border-ink ' +
                    (active ? 'bg-ink' : 'bg-surface')
                  }
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-ground" />}
                </span>
                <span>
                  <span className="block font-bold">{m.name}</span>
                  <span className="block text-[13px] text-muted">{m.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg">LinkedIn</h2>
        <p className="mt-1 text-sm text-muted">
          Some LinkedIn job pages need you signed in. Log in once here and the session is
          reused whenever you paste a LinkedIn link.
        </p>
        <Button className="mt-3" onClick={() => call(api.system.linkedinLogin())}>
          Log in to LinkedIn
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg">Data</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Stat label="AI calls made" value={String(usage.calls)} />
          <Stat label="Estimated spend" value={money(usage.estimatedUsd)} />
          <Stat label="Input tokens" value={usage.inputTokens.toLocaleString()} />
          <Stat label="Output tokens" value={usage.outputTokens.toLocaleString()} />
        </dl>
        <p className="mt-3 text-sm text-muted">
          Everything is stored in a plain <code className="font-mono text-[13px]">db.json</code>{' '}
          plus your resume PDFs, in the data folder. New app versions keep reading the same
          folder — updating never touches your applications.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => call(api.system.openDataFolder())}>Open data folder</Button>
          <Button
            onClick={async () => {
              setBusy('export')
              try {
                await call(api.system.exportAll())
                toast.push('success', 'Backup written.')
              } catch (e) {
                toast.push('error', e instanceof Error ? e.message : 'Export failed.')
              } finally {
                setBusy(null)
              }
            }}
            disabled={busy !== null}
          >
            {busy === 'export' ? <Spinner /> : 'Export a copy now'}
          </Button>
        </div>
      </Card>

      <BackupsCard />

      <p className="text-center text-[11px] text-muted">Job Dashboard v{version || '…'}</p>
    </div>
  )
}

function ProfileCard() {
  const { settings, saveProfile } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState<UserProfile>(settings.profile)

  useEffect(() => {
    setForm(settings.profile)
  }, [settings.profile])

  const commit = async (next: UserProfile) => {
    if (JSON.stringify(next) === JSON.stringify(settings.profile)) return
    try {
      await saveProfile(next)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not save.')
    }
  }

  type StringKey = {
    [K in keyof UserProfile]: UserProfile[K] extends string ? K : never
  }[keyof UserProfile]
  const field = (k: StringKey) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
    onBlur: () => void commit({ ...form, [k]: (form[k] as string).trim() }),
  })

  type NullableStringKey = {
    [K in keyof UserProfile]: UserProfile[K] extends string | null ? K : never
  }[keyof UserProfile]
  const nullableField = (k: NullableStringKey) => ({
    value: (form[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
    onBlur: () => void commit({ ...form, [k]: (form[k] as string | null)?.trim() || null }),
  })

  function setSponsorship(v: string) {
    const next = v === 'yes' ? true : v === 'no' ? false : null
    const updated = { ...form, requiresSponsorship: next }
    setForm(updated)
    void commit(updated)
  }

  function updateEducation(next: EducationEntry[]) {
    const updated = { ...form, education: next }
    setForm(updated)
    void commit(updated)
  }
  function addEducation() {
    updateEducation([...form.education, { school: '', degree: '', field: '', gradYear: null }])
  }
  function removeEducation(i: number) {
    updateEducation(form.education.filter((_, idx) => idx !== i))
  }
  function patchEducation(i: number, patch: Partial<EducationEntry>) {
    setForm((f) => ({
      ...f,
      education: f.education.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    }))
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg">You</h2>
      <p className="mt-1 text-sm text-muted">
        Used to sign referral emails and to autofill job applications via the browser extension.
        Stored only in your local database — never sent anywhere except the applications you
        choose to submit.
      </p>

      <h3 className="mt-4 text-[12px] font-bold uppercase tracking-wide text-muted">Contact</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Fieldset label="Name">
          <Input placeholder="Jordan Rivera" {...field('name')} />
        </Fieldset>
        <Fieldset label="Email">
          <Input type="email" placeholder="jordan@example.com" {...field('email')} />
        </Fieldset>
        <Fieldset label="Phone">
          <Input placeholder="+1 555 010 0101" {...field('phone')} />
        </Fieldset>
        <Fieldset label="LinkedIn">
          <Input placeholder="linkedin.com/in/…" {...field('linkedinUrl')} />
        </Fieldset>
        <Fieldset label="GitHub">
          <Input placeholder="github.com/…" {...field('githubUrl')} />
        </Fieldset>
        <Fieldset label="Portfolio">
          <Input placeholder="yoursite.com" {...field('portfolioUrl')} />
        </Fieldset>
      </div>

      <h3 className="mt-5 text-[12px] font-bold uppercase tracking-wide text-muted">Address</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Fieldset label="Street address" className="sm:col-span-2">
          <Input placeholder="123 Main St" {...field('addressLine1')} />
        </Fieldset>
        <Fieldset label="City">
          <Input placeholder="Austin" {...field('city')} />
        </Fieldset>
        <Fieldset label="State / region">
          <Input placeholder="TX" {...field('state')} />
        </Fieldset>
        <Fieldset label="Postal code">
          <Input placeholder="78701" {...field('postalCode')} />
        </Fieldset>
        <Fieldset label="Country">
          <Input placeholder="United States" {...field('country')} />
        </Fieldset>
      </div>

      <h3 className="mt-5 text-[12px] font-bold uppercase tracking-wide text-muted">
        Work authorization
      </h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Fieldset label="Status" hint="your own words">
          <Input placeholder="e.g. US Citizen" {...nullableField('workAuthorization')} />
        </Fieldset>
        <Fieldset label="Requires sponsorship?">
          <Select
            ariaLabel="Requires sponsorship"
            value={
              form.requiresSponsorship === true
                ? 'yes'
                : form.requiresSponsorship === false
                  ? 'no'
                  : ''
            }
            onChange={setSponsorship}
            options={[
              { value: '', label: 'Not answered — left blank on applications' },
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ]}
          />
        </Fieldset>
      </div>

      <h3 className="mt-5 text-[12px] font-bold uppercase tracking-wide text-muted">Education</h3>
      <div className="mt-2 space-y-2">
        {form.education.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_90px_28px] items-center gap-1.5">
            <Input
              placeholder="School"
              value={e.school}
              onChange={(ev) => patchEducation(i, { school: ev.target.value })}
              onBlur={() => void commit(form)}
            />
            <Input
              placeholder="Degree"
              value={e.degree}
              onChange={(ev) => patchEducation(i, { degree: ev.target.value })}
              onBlur={() => void commit(form)}
            />
            <Input
              placeholder="Field of study"
              value={e.field}
              onChange={(ev) => patchEducation(i, { field: ev.target.value })}
              onBlur={() => void commit(form)}
            />
            <Input
              placeholder="Year"
              value={e.gradYear ?? ''}
              onChange={(ev) => patchEducation(i, { gradYear: ev.target.value })}
              onBlur={() => void commit(form)}
            />
            <button
              type="button"
              aria-label="Remove school"
              onClick={() => removeEducation(i)}
              className="nb-focus text-muted hover:text-accent-coral"
            >
              ×
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addEducation}>
          ＋ Add school
        </Button>
      </div>

      <h3 className="mt-5 text-[12px] font-bold uppercase tracking-wide text-muted">
        Voluntary self-identification
      </h3>
      <p className="mt-1 text-[13px] text-muted">
        Some applications ask these as optional EEO questions. Answer once here if you want to —
        leave a field blank to skip it on every application instead.
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Fieldset label="Gender">
          <Input placeholder="leave blank to skip" {...nullableField('eeoGender')} />
        </Fieldset>
        <Fieldset label="Race / ethnicity">
          <Input placeholder="leave blank to skip" {...nullableField('eeoRace')} />
        </Fieldset>
        <Fieldset label="Veteran status">
          <Input placeholder="leave blank to skip" {...nullableField('eeoVeteranStatus')} />
        </Fieldset>
        <Fieldset label="Disability status">
          <Input placeholder="leave blank to skip" {...nullableField('eeoDisabilityStatus')} />
        </Fieldset>
      </div>
    </Card>
  )
}

function ExtensionCard() {
  const { settings } = useAppData()
  const { copied, copy } = useCopy()
  const ext = settings.extension

  return (
    <Card className="p-5">
      <h2 className="text-lg">Browser extension</h2>
      <p className="mt-1 text-sm text-muted">
        Autofills a job application from the tailored resume already attached to that job — not
        a generic saved profile. Install{' '}
        <span className="font-semibold">Job Dashboard Autofill</span> (load it unpacked from{' '}
        <code>job-dashboard-extension/</code>), then paste this token into its Options page.
        Everything stays on this machine — the extension only ever talks to{' '}
        <code>127.0.0.1</code>.
      </p>
      {ext ? (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate border-2 border-ink bg-ground px-2 py-1.5 text-[13px]">
            {ext.token}
          </code>
          <Button variant="outline" size="sm" onClick={() => void copy(ext.token)}>
            {copied ? '✓ Copied' : 'Copy token'}
          </Button>
        </div>
      ) : null}
      {ext && (
        <p className="mt-1.5 text-[12px] text-muted">
          {ext.token.length} characters — the box above is truncated for display; use{' '}
          <b>Copy token</b> rather than selecting the text by hand, and check the extension's
          Options page shows the same character count after saving. Every pairing attempt is
          logged to <code>autofill-server.log</code> in "Open data folder" below — it records
          exactly what was received and why it was accepted or rejected (the full token is
          never written, only a masked prefix/suffix).
        </p>
      )}
      {!ext && (
        <p className="mt-3 text-sm text-muted">Restart Job Dashboard to generate a token.</p>
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-ink bg-ground px-2.5 py-1.5">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-display text-lg font-bold">{value}</dd>
    </div>
  )
}

function BackupsCard() {
  const toast = useToast()
  const confirm = useConfirm()
  const { refresh } = useAppData()
  const [backups, setBackups] = useState<
    { name: string; savedAt: string; label: string; applications: number }[]
  >([])
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = () =>
    call(api.system.backupsList())
      .then(setBackups)
      .catch(() => {})
  useEffect(() => {
    void load()
  }, [])

  async function restore(name: string, label: string) {
    const yes = await confirm({
      title: 'Restore this snapshot?',
      body: `All current applications are replaced with the snapshot from ${label}. Your current state is saved as an extra backup first, so this is reversible.`,
      confirmLabel: 'Restore',
    })
    if (!yes) return
    setRestoring(name)
    try {
      const n = await call(api.system.backupRestore(name))
      await refresh()
      await load()
      toast.push('success', `Restored — ${n} application${n === 1 ? '' : 's'}.`)
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Restore failed.')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg">Automatic backups</h2>
      <p className="mt-1 text-sm text-muted">
        A snapshot is saved on every launch and right before any delete — each distinct state
        keeps its own copy, and the last 40 are kept. If something ever looks wrong, roll back.
      </p>
      {backups.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No snapshots yet — they appear after the next launch.</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto nb-scroll pr-1">
          {backups.map((b) => (
            <li
              key={b.name}
              className="flex items-center justify-between gap-3 border-2 border-ink bg-ground px-3 py-2 text-sm"
            >
              <span className="font-semibold">
                {b.label}
                <span className="ml-2 font-normal text-muted">
                  {b.applications} application{b.applications === 1 ? '' : 's'}
                </span>
              </span>
              <Button
                size="sm"
                onClick={() => restore(b.name, b.label)}
                disabled={restoring !== null}
              >
                {restoring === b.name ? <Spinner /> : 'Restore'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
