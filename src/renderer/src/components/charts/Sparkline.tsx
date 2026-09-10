import { linear } from './primitives'

/** Tiny axis-less line for a KPI tile. */
export function Sparkline({
  data,
  color = '#141414',
  width = 96,
  height = 28,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const x = linear([0, data.length - 1], [1, width - 1])
  const y = linear([0, max], [height - 2, 2])
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.5} fill={color} />
    </svg>
  )
}
