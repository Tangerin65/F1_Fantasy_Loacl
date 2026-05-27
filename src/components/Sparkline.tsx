interface SparklineProps {
  values: number[]
  accent?: 'red' | 'cyan' | 'gold'
}

const WIDTH = 126
const HEIGHT = 34
const PADDING = 3

const ACCENT_MAP: Record<NonNullable<SparklineProps['accent']>, string> = {
  red: '#e10600',
  cyan: '#00ffff',
  gold: '#ffd700',
}

const toPointPath = (values: number[]) => {
  if (!values.length) {
    return ''
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const step = (WIDTH - PADDING * 2) / Math.max(values.length - 1, 1)

  return values
    .map((value, index) => {
      const x = PADDING + step * index
      const y =
        HEIGHT -
        PADDING -
        ((value - min) / range) * (HEIGHT - PADDING * 2)
      return `${x},${y}`
    })
    .join(' ')
}

export function Sparkline({ values, accent = 'red' }: SparklineProps) {
  const points = toPointPath(values)
  const color = ACCENT_MAP[accent]

  if (!points) {
    return (
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="sparkline" role="img" aria-label="No recent rounds">
        <line
          x1={PADDING}
          x2={WIDTH - PADDING}
          y1={HEIGHT / 2}
          y2={HEIGHT / 2}
          className="sparkline__empty"
        />
      </svg>
    )
  }

  const pairs = points.split(' ')
  const [lastX, lastY] = (pairs[pairs.length - 1] ?? `${WIDTH - PADDING},${HEIGHT - PADDING}`).split(',')

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="sparkline" role="img" aria-label="Recent points trend">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={lastX}
        cy={lastY}
        r="2.8"
        fill={color}
      />
    </svg>
  )
}
