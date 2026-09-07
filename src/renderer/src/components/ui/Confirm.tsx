import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'

interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>()

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const finish = (v: boolean) => {
    resolver.current?.(v)
    resolver.current = undefined
    setOpts(null)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onClose={() => finish(false)} title={opts?.title ?? ''} width="max-w-md">
        {opts?.body && (
          <div className="mb-4 text-[15px] leading-relaxed text-ink/90">{opts.body}</div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => finish(false)}>
            {opts?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={opts?.danger ? 'danger' : 'primary'}
            onClick={() => finish(true)}
          >
            {opts?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </Dialog>
    </ConfirmCtx.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
