import { useEffect, useState } from 'react'
import { useAppData } from '@/lib/store'
import { api, call } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Fieldset } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/misc'
import { money } from '@/lib/format'
import type { ExtractionModel } from '@shared/types'

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
        <div className="mt-4 flex flex-wrap gap-2">
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
            {busy === 'export' ? <Spinner /> : 'Export backup'}
          </Button>
        </div>
      </Card>

      <p className="text-center text-[11px] text-muted">Job Dashboard v{version || '…'}</p>
    </div>
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
