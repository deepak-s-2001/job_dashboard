import type { FunnelStage } from '@/lib/metrics'

const STAGE_COLOR: Record<string, string> = {
  applied: '#6c8cff',
  responded: '#23a094',
  interviewed: '#ffc900',
  offered: '#22c55e',
}

export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = Math.max(1, stages[0]?.n ?? 1)
  return (
    <div className="border-3 border-ink bg-surface rounded p-4 shadow-hard-sm">
      <h3 className="font-display text-base font-bold uppercase tracking-wide">Funnel</h3>
      <p className="mb-3 text-[12px] text-muted">
        how many of your applications ever reached each stage
      </p>
      <div className="space-y-2">
        {stages.map((s) => (
          <div key={s.key}>
            <div className="mb-0.5 flex items-baseline justify-between text-[12px] font-bold">
              <span>{s.label}</span>
              <span>
                {s.n}
                {s.dropPct > 0 && <span className="ml-1.5 font-normal text-muted">↓ {s.dropPct}%</span>}
              </span>
            </div>
            <div className="h-6 border-2 border-ink bg-ground">
              <div
                className="h-full border-r-2 border-ink"
                style={{ width: `${Math.max(2, (s.n / top) * 100)}%`, background: STAGE_COLOR[s.key] }}
              />
            </div>
          </div>
        ))}
      </div>
      {stages[0]?.n === 0 && (
        <p className="mt-3 text-[13px] text-muted">No applications yet — the funnel fills as you apply.</p>
      )}
    </div>
  )
}
