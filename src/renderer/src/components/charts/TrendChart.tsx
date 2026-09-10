import { useRef, useState } from 'react'
import type { WeekPoint } from '@/lib/metrics'
import { CHART, linear, niceMax, ticks } from './primitives'
import { cn } from '@/lib/cn'

const W = 640
const H = 240
const PAD = { l: 32, r: 12, t: 12, b: 28 }

function fmtWeek(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TrendChart({ data }: { data: WeekPoint[] }) {
  const [cumulative, setCumulative] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const rows = view(data, cumulative)
  const max = niceMax(Math.max(1, ...rows.flatMap((d) => [d.applied, d.responded])))
  const x = linear([0, Math.max(1, data.length - 1)], [PAD.l, W - PAD.r])
  const y = linear([0, max], [H - PAD.b, PAD.t])

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(linear([PAD.l, W - PAD.r], [0, data.length - 1])(px))
    setHover(i >= 0 && i < data.length ? i : null)
  }

  return (
    <div className="border-3 border-ink bg-surface rounded p-4 shadow-hard-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-bold uppercase tracking-wide">
          Applications over time
        </h3>
        <div className="ml-auto flex items-center gap-1.5 text-[12px] font-bold">
          <Legend color={CHART.applied} label="Applied" />
          <Legend color={CHART.responded} label="Responded" />
        </div>
      </div>
      <div className="mb-2 flex gap-1.5">
        <Toggle on={!cumulative} onClick={() => setCumulative(false)}>weekly</Toggle>
        <Toggle on={cumulative} onClick={() => setCumulative(true)}>cumulative</Toggle>
        <Toggle on={showTable} onClick={() => setShowTable((v) => !v)} className="ml-auto">
          ▦ numbers
        </Toggle>
      </div>

      {showTable ? (
        <div className="max-h-[220px] overflow-y-auto nb-scroll border-2 border-ink">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 border-b-2 border-ink bg-ground">
              <tr>
                <th className="px-2 py-1 text-left">Week</th>
                <th className="px-2 py-1 text-right">Applied</th>
                <th className="px-2 py-1 text-right">Responded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.weekStart} className="border-b border-ink/15 last:border-0">
                  <td className="px-2 py-1">{fmtWeek(d.weekStart)}</td>
                  <td className="px-2 py-1 text-right font-bold">{d.applied}</td>
                  <td className="px-2 py-1 text-right">{d.responded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label="Weekly applications and responses"
          >
            {ticks(max).map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth={1} />
                <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#5a5245">
                  {t}
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke={CHART.ink} strokeWidth={2} />
            {rows.map((d, i) =>
              i % Math.max(1, Math.ceil(data.length / 8)) === 0 ? (
                <text key={i} x={x(i)} y={H - PAD.b + 14} textAnchor="middle" fontSize={10} fill="#5a5245">
                  {fmtWeek(d.weekStart)}
                </text>
              ) : null,
            )}
            <path d={linePath(rows, 'responded', x, y)} fill="none" stroke={CHART.responded} strokeWidth={2.5} strokeLinejoin="round" />
            <path d={linePath(rows, 'applied', x, y)} fill="none" stroke={CHART.applied} strokeWidth={3} strokeLinejoin="round" />
            {hover != null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke={CHART.ink} strokeWidth={1.5} strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(rows[hover].applied)} r={4} fill={CHART.applied} stroke="#fff" strokeWidth={2} />
                <circle cx={x(hover)} cy={y(rows[hover].responded)} r={4} fill={CHART.responded} stroke="#fff" strokeWidth={2} />
              </>
            )}
          </svg>
          {hover != null && (
            <div
              className="pointer-events-none absolute -top-1 border-2 border-ink bg-surface px-2 py-1 text-[11px] font-bold shadow-hard-sm"
              style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {fmtWeek(rows[hover].weekStart)} · applied {rows[hover].applied} · responded{' '}
              {rows[hover].responded}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function view(data: WeekPoint[], cumulative: boolean): WeekPoint[] {
  if (!cumulative) return data
  let a = 0
  let r = 0
  return data.map((d) => {
    a += d.applied
    r += d.responded
    return { ...d, applied: a, responded: r }
  })
}

function linePath(
  rows: WeekPoint[],
  key: 'applied' | 'responded',
  x: (v: number) => number,
  y: (v: number) => number,
): string {
  return rows
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`)
    .join(' ')
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2.5 w-4 border-2 border-ink" style={{ background: color }} />
      {label}
    </span>
  )
}

function Toggle({
  on,
  onClick,
  children,
  className,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-2 border-ink px-2 py-0.5 text-[11px] font-bold',
        on ? 'bg-ink text-ground' : 'bg-surface hover:bg-ground',
        className,
      )}
    >
      {children}
    </button>
  )
}
