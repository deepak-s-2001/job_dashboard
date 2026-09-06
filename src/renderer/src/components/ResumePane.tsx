import { useCallback, useEffect, useRef, useState } from 'react'
import type { Application } from '@shared/types'
import { api, call } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PdfViewer } from './PdfViewer'
import { IconButton, Spinner } from './ui/misc'
import { cn } from '@/lib/cn'
import { fmtDate } from '@/lib/format'

export function ResumePane({
  app,
  autoAttach,
  onChanged,
}: {
  app: Application
  autoAttach?: boolean
  onChanged: () => void | Promise<void>
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<string | null>(
    app.resumes.find((r) => r.isPrimary)?.id ?? app.resumes[0]?.id ?? null,
  )
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  // keep a valid selection as resumes change
  useEffect(() => {
    if (app.resumes.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !app.resumes.some((r) => r.id === selected)) {
      setSelected(app.resumes.find((r) => r.isPrimary)?.id ?? app.resumes[0].id)
    }
  }, [app.resumes, selected])

  // load bytes for the selected resume
  useEffect(() => {
    let cancelled = false
    if (!selected) {
      setBytes(null)
      return
    }
    setLoadingPdf(true)
    call(api.resumes.readData(app.id, selected))
      .then((res) => {
        if (cancelled) return
        const raw = res.data as unknown
        const u8 =
          raw instanceof Uint8Array
            ? raw
            : new Uint8Array((raw as { data: number[] })?.data ?? (raw as ArrayBuffer))
        setBytes(u8)
      })
      .catch((e) => {
        if (!cancelled) toast.push('error', e instanceof Error ? e.message : 'Could not load PDF.')
      })
      .finally(() => !cancelled && setLoadingPdf(false))
    return () => {
      cancelled = true
    }
  }, [selected, app.id, toast])

  const attach = useCallback(
    async (path?: string) => {
      setBusy(true)
      try {
        const resume = await call(api.resumes.attach(app.id, path))
        await onChanged()
        setSelected(resume.id)
        toast.push('success', `Attached ${resume.filename}`)
      } catch (e) {
        toast.push('error', e instanceof Error ? e.message : 'Could not attach the resume.')
      } finally {
        setBusy(false)
      }
    },
    [app.id, onChanged, toast],
  )

  useEffect(() => {
    if (autoAttach && app.resumes.length === 0) inputRef.current?.click()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAttach])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.push('error', 'Only PDF resumes are supported.')
      return
    }
    const path = window.api.system.pathForFile(file)
    void attach(path || undefined)
  }

  async function remove(id: string) {
    if (!confirm('Remove this resume from the job? The file is deleted from the app folder.')) return
    try {
      await call(api.resumes.remove(app.id, id))
      await onChanged()
      toast.push('info', 'Resume removed.')
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Could not remove.')
    }
  }

  async function makePrimary(id: string) {
    await call(api.resumes.setPrimary(app.id, id))
    await onChanged()
  }

  const current = app.resumes.find((r) => r.id === selected)

  return (
    <div
      className={cn(
        'flex h-full flex-col border-3 border-ink bg-surface rounded shadow-hard',
        dragOver && 'ring-4 ring-accent-yellow',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void attach(window.api.system.pathForFile(f) || undefined)
          e.target.value = ''
        }}
      />

      <div className="flex flex-none flex-wrap items-center gap-1.5 border-b-3 border-ink bg-ground px-2 py-1.5">
        {app.resumes.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            title={`${r.filename} · added ${fmtDate(r.addedAt)}`}
            className={cn(
              'nb-focus max-w-[160px] truncate border-2 border-ink px-2 py-0.5 text-[12px] font-bold',
              r.id === selected ? 'bg-accent-yellow' : 'bg-surface hover:bg-ground',
            )}
          >
            {r.isPrimary && '★ '}
            v{i + 1}
            <span className="ml-1 font-normal text-muted">
              {r.filename.replace(/\.pdf$/i, '').slice(0, 18)}
            </span>
          </button>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="nb-focus border-2 border-dashed border-ink px-2 py-0.5 text-[12px] font-bold hover:bg-accent-lime disabled:opacity-50"
        >
          {busy ? <Spinner className="h-3 w-3" /> : '+ add version'}
        </button>

        {current && (
          <div className="ml-auto flex items-center gap-1">
            {!current.isPrimary && app.resumes.length > 1 && (
              <IconButton title="Make primary" onClick={() => makePrimary(current.id)}>
                ★
              </IconButton>
            )}
            <IconButton
              title="Open in system viewer"
              onClick={() => call(api.resumes.openExternal(app.id, current.id))}
            >
              ↗
            </IconButton>
            <IconButton title="Remove" onClick={() => remove(current.id)}>
              🗑
            </IconButton>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {app.resumes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center border-3 border-dashed border-ink rounded text-3xl">
              📄
            </div>
            <p className="text-sm font-semibold">Drop the resume PDF you sent for this job</p>
            <p className="text-[12px] text-muted">or</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="nb-focus border-3 border-ink bg-accent-yellow px-4 py-2 text-sm font-bold shadow-hard hover:-translate-y-[1px]"
            >
              Choose a file
            </button>
          </div>
        ) : loadingPdf && !bytes ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
            <Spinner /> Loading…
          </div>
        ) : (
          <PdfViewer data={bytes} />
        )}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent-yellow/40 text-lg font-bold">
            Drop to attach
          </div>
        )}
      </div>
    </div>
  )
}
