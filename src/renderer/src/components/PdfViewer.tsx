import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { IconButton, Spinner } from './ui/misc'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export function PdfViewer({ data }: { data: Uint8Array | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)

  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // (re)load the document when the bytes change
  useEffect(() => {
    let cancelled = false
    if (!data || data.byteLength === 0) {
      docRef.current = null
      setPageCount(0)
      return
    }
    setLoading(true)
    setError(null)
    // copy — pdf.js transfers/detaches the buffer it's given
    const bytes = data.slice()
    pdfjs
      .getDocument({ data: bytes })
      .promise.then((doc) => {
        if (cancelled) return
        docRef.current = doc
        setPageCount(doc.numPages)
        setPage(1)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open the PDF.')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [data])

  // render the current page
  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || page < 1 || page > doc.numPages) return
    let cancelled = false

    void (async () => {
      const pdfPage = await doc.getPage(page)
      if (cancelled) return
      const unscaled = pdfPage.getViewport({ scale: 1 })
      const containerW = (containerRef.current?.clientWidth ?? 800) - 24
      const scale = (fitWidth ? containerW / unscaled.width : 1) * zoom
      const dpr = window.devicePixelRatio || 1
      const viewport = pdfPage.getViewport({ scale })
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      renderTaskRef.current?.cancel()
      const task = pdfPage.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = task
      try {
        await task.promise
      } catch {
        /* cancelled by the next render — fine */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [page, zoom, fitWidth, pageCount])

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        No resume selected.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none items-center gap-1.5 border-b-3 border-ink bg-ground px-2 py-1.5">
        <IconButton disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ‹
        </IconButton>
        <span className="min-w-[64px] text-center text-[12px] font-bold">
          {pageCount ? `${page} / ${pageCount}` : '—'}
        </span>
        <IconButton
          disabled={page >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
        >
          ›
        </IconButton>
        <div className="mx-1 h-6 w-0.5 bg-ink/20" />
        <IconButton onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}>
          −
        </IconButton>
        <span className="min-w-[44px] text-center text-[12px] font-bold">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}>
          +
        </IconButton>
        <IconButton active={fitWidth} onClick={() => setFitWidth((v) => !v)} title="Fit width">
          ⇔
        </IconButton>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto nb-scroll bg-[#e9e0cf] p-3"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner /> Rendering…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-accent-coral">
            {error}
          </div>
        )}
        <canvas ref={canvasRef} className="mx-auto border-2 border-ink bg-white shadow-hard" />
      </div>
    </div>
  )
}
