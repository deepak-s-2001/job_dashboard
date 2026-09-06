import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAppData } from '@/lib/store'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { Button } from './ui/Button'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▚', end: true },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { apps, usage, settings } = useAppData()
  const navigate = useNavigate()

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-60 flex-none flex-col border-r-3 border-ink bg-accent-pink">
        <div className="border-b-3 border-ink px-4 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/70">
            Personal
          </div>
          <div className="font-display text-2xl font-bold leading-none">
            Job
            <br />
            Dashboard
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'nb-focus flex items-center gap-2.5 border-3 border-ink rounded px-3 py-2 text-sm font-bold transition-transform',
                  isActive
                    ? 'bg-ink text-ground shadow-hard'
                    : 'bg-surface text-ink hover:-translate-y-[1px] hover:shadow-hard',
                )
              }
            >
              <span className="text-base leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 p-3">
          <Button variant="accent" block onClick={() => navigate('/add')} className="bg-accent-yellow">
            <span className="text-lg leading-none">+</span> Add application
          </Button>
          <button
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            className="nb-focus flex w-full items-center justify-center gap-2 border-2 border-ink bg-surface/70 px-3 py-1.5 text-[12px] font-semibold hover:bg-surface"
          >
            Quick jump
            <kbd className="border border-ink bg-ground px-1 text-[10px]">⌘K</kbd>
          </button>
        </div>

        <div className="mt-auto space-y-2 border-t-3 border-ink p-3 text-[12px]">
          <div className="flex items-center justify-between border-2 border-ink bg-surface px-2 py-1">
            <span className="font-semibold text-muted">Applications</span>
            <span className="font-bold">{apps.length}</span>
          </div>
          <div className="flex items-center justify-between border-2 border-ink bg-surface px-2 py-1">
            <span className="font-semibold text-muted">AI spend</span>
            <span className="font-bold" title={`${usage.calls} calls`}>
              {money(usage.estimatedUsd)}
            </span>
          </div>
          <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-ink/50">
            {settings.extractionModel.replace('claude-', '')}
          </div>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto nb-scroll">{children}</main>
    </div>
  )
}
