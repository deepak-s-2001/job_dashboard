import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'

type Kind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: Kind
  message: string
}

const ToastCtx = createContext<{
  push: (kind: Kind, message: string) => void
} | null>(null)

const STYLES: Record<Kind, string> = {
  success: 'bg-accent-lime text-ink',
  error: 'bg-accent-coral text-ink',
  info: 'bg-accent-cyan text-ink',
}
const ICON: Record<Kind, string> = { success: '✓', error: '!', info: 'i' }

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: Kind, message: string) => {
    const id = ++seq
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              role={t.kind === 'error' ? 'alert' : 'status'}
              aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 border-3 border-ink rounded p-3 text-sm font-medium shadow-hard',
                STYLES[t.kind],
              )}
            >
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-ink bg-surface text-[11px] font-bold text-ink">
                {ICON[t.kind]}
              </span>
              <span className="leading-snug">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
