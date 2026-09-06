import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

const dragStyle: React.CSSProperties = { WebkitAppRegion: 'drag' }
const noDragStyle: React.CSSProperties = { WebkitAppRegion: 'no-drag' }

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void api.win.isMaximized().then(setMaximized).catch(() => {})
    return api.win.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div
      style={dragStyle}
      onDoubleClick={() => void api.win.toggleMaximize()}
      className="flex h-10 flex-none select-none items-center gap-2 border-b-3 border-ink bg-ink pl-3.5 pr-2 text-ground"
    >
      <span className="h-3.5 w-3.5 border-2 border-ground bg-accent-pink" aria-hidden />
      <span className="text-[13px] font-bold uppercase tracking-[0.24em]">Job Dashboard</span>

      <div className="ml-auto flex items-center gap-1.5" style={noDragStyle}>
        <WinButton label="Minimize" onClick={() => void api.win.minimize()}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <rect x="1.5" y="5.25" width="9" height="2" fill="currentColor" />
          </svg>
        </WinButton>
        <WinButton label={maximized ? 'Restore' : 'Maximize'} onClick={() => void api.win.toggleMaximize()}>
          {maximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="1.5" y="3.5" width="6" height="6" />
              <path d="M4 3.5V1.5h6.5V8h-2" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="1.75" y="1.75" width="8.5" height="8.5" />
            </svg>
          )}
        </WinButton>
        <WinButton label="Close" danger onClick={() => void api.win.close()}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </WinButton>
      </div>
    </div>
  )
}

function WinButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'nb-focus flex h-7 w-9 items-center justify-center border-2 border-ground bg-ink text-ground transition-colors',
        danger
          ? 'hover:border-ink hover:bg-accent-coral hover:text-ink'
          : 'hover:border-ink hover:bg-accent-yellow hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
