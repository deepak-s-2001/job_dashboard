import type { Application, Interview } from '@shared/types'
import {
  INTERVIEW_FORMATS,
  INTERVIEW_OUTCOMES,
  INTERVIEW_ROUND_PRESETS,
} from '@shared/types'
import { useAppData } from '@/lib/store'
import { useToast } from './ui/Toast'
import { Button } from './ui/Button'
import { Input, Textarea, Select, Fieldset } from './ui/Field'
import { titleCase } from '@/lib/format'
import { cn } from '@/lib/cn'

let seq = 0
const newId = () => `iv_${Date.now().toString(36)}_${(seq++).toString(36)}`

const OUTCOME_COLOR: Record<string, string> = {
  scheduled: '#6c8cff',
  passed: '#22c55e',
  failed: '#ff6b57',
  cancelled: '#9ca3af',
  'no-show': '#9ca3af',
}

/** naive local-ISO for <input type="datetime-local"> round-trips */
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '')
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

export function JobInterviews({
  app,
  onPatch,
}: {
  app: Application
  onPatch: (p: Partial<Application>) => Promise<void>
}) {
  const { createTodo } = useAppData()
  const toast = useToast()
  const list = app.interviews ?? []

  function save(next: Interview[]) {
    const patch: Partial<Application> = { interviews: next }
    // adding the first round means you're interviewing — advance the pipeline
    if (
      next.length > list.length &&
      (app.status === 'not-applied' || app.status === 'applied')
    ) {
      patch.status = 'interviewing'
    }
    void onPatch(patch)
  }

  function addRound(round = '') {
    const iv: Interview = {
      id: newId(),
      round,
      at: null,
      format: null,
      withWhom: '',
      prepNotes: '',
      outcome: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    save([...list, iv])
  }

  function patchRound(id: string, p: Partial<Interview>) {
    save(list.map((iv) => (iv.id === id ? { ...iv, ...p, updatedAt: new Date().toISOString() } : iv)))
  }

  function removeRound(id: string) {
    save(list.filter((iv) => iv.id !== id))
  }

  return (
    <div className="space-y-4">
      <Fieldset label="Offer decision deadline">
        <Input
          type="date"
          value={app.offerDeadline ?? ''}
          onChange={(e) => void onPatch({ offerDeadline: e.target.value || null })}
          className="max-w-[200px]"
        />
      </Fieldset>

      {list.length === 0 ? (
        <p className="text-[14px] text-muted">No rounds logged. Add one as you schedule it.</p>
      ) : (
        <ol className="space-y-3">
          {list.map((iv, i) => (
            <li key={iv.id} className="border-3 border-ink bg-surface rounded p-3 shadow-hard-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-display text-sm font-bold text-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <input
                  defaultValue={iv.round}
                  key={iv.id + ':round:' + iv.round}
                  onBlur={(e) => {
                    if (e.target.value !== iv.round) patchRound(iv.id, { round: e.target.value })
                  }}
                  placeholder="Round (e.g. Hiring manager)"
                  list="iv-rounds"
                  className="flex-1 border-b-2 border-ink bg-transparent py-0.5 text-[15px] font-bold outline-none"
                />
                <span
                  className="border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold uppercase"
                  style={{ background: OUTCOME_COLOR[iv.outcome] }}
                >
                  {iv.outcome}
                </span>
                <button
                  onClick={() => removeRound(iv.id)}
                  aria-label="Remove round"
                  className="nb-focus px-1 text-ink/50 hover:text-accent-coral"
                >
                  ×
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">
                  When
                  <input
                    type="datetime-local"
                    value={toLocalInput(iv.at)}
                    onChange={(e) => patchRound(iv.id, { at: fromLocalInput(e.target.value) })}
                    className="mt-1 block w-full border-2 border-ink bg-surface px-2 py-1 text-[13px] font-normal outline-none"
                  />
                </label>
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">
                  Format
                  <div className="mt-1 font-normal">
                    <Select
                      size="sm"
                      ariaLabel="Interview format"
                      value={iv.format ?? ''}
                      onChange={(v) => patchRound(iv.id, { format: (v || null) as Interview['format'] })}
                      options={[
                        { value: '', label: '—' },
                        ...INTERVIEW_FORMATS.map((f) => ({ value: f, label: titleCase(f) })),
                      ]}
                    />
                  </div>
                </label>
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">
                  With whom
                  <input
                    defaultValue={iv.withWhom}
                    key={iv.id + ':who:' + iv.withWhom}
                    onBlur={(e) => {
                      if (e.target.value !== iv.withWhom) patchRound(iv.id, { withWhom: e.target.value })
                    }}
                    placeholder="Priya S (eng manager)"
                    className="mt-1 block w-full border-2 border-ink bg-surface px-2 py-1 text-[13px] font-normal outline-none"
                  />
                </label>
                <label className="text-[12px] font-bold uppercase tracking-wide text-muted">
                  Outcome
                  <div className="mt-1 font-normal">
                    <Select
                      size="sm"
                      ariaLabel="Interview outcome"
                      value={iv.outcome}
                      onChange={(v) => patchRound(iv.id, { outcome: v as Interview['outcome'] })}
                      options={INTERVIEW_OUTCOMES.map((o) => ({ value: o, label: titleCase(o) }))}
                    />
                  </div>
                </label>
              </div>

              <Textarea
                defaultValue={iv.prepNotes}
                key={iv.id + ':' + iv.prepNotes}
                onBlur={(e) => {
                  if (e.target.value !== iv.prepNotes) patchRound(iv.id, { prepNotes: e.target.value })
                }}
                rows={2}
                placeholder="Prep notes — topics, people to research, questions to ask… (saves when you click away)"
                className="mt-2 text-[13px]"
              />
              <button
                onClick={async () => {
                  await createTodo({
                    text: `Prep for ${iv.round || 'the interview'} — ${app.company}`,
                    applicationId: app.id,
                    dueDate: iv.at ? iv.at.slice(0, 10) : null,
                  })
                  toast.push('success', 'Prep to-do added.')
                }}
                className="mt-1.5 border-2 border-dashed border-ink px-2 py-0.5 text-[12px] font-bold text-muted hover:border-solid hover:bg-accent-lime hover:text-ink"
              >
                ＋ prep to-do
              </button>
            </li>
          ))}
        </ol>
      )}

      <datalist id="iv-rounds">
        {INTERVIEW_ROUND_PRESETS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className="flex flex-wrap gap-1.5">
        <Button variant="primary" size="sm" onClick={() => addRound()}>
          ＋ Add round
        </Button>
        {INTERVIEW_ROUND_PRESETS.slice(0, 5).map((r) => (
          <button
            key={r}
            onClick={() => addRound(r)}
            className={cn(
              'border-2 border-dashed border-ink px-2 py-0.5 text-[12px] font-bold text-muted',
              'hover:border-solid hover:bg-accent-yellow hover:text-ink',
            )}
          >
            + {r}
          </button>
        ))}
      </div>
    </div>
  )
}
