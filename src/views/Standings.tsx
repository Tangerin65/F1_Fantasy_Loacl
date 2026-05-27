import { useMemo } from 'react'
import { TrendArrow } from '../components/TrendArrow'
import { useGame } from '../context/useGame'

const CHART_WIDTH = 820
const CHART_HEIGHT = 300
const CHART_PADDING = 30
const CHART_COLORS = ['#45b8ff', '#ff48d0', '#ff9d2e', '#5dff81']
const formatPoints = (value: number) => `${value.toFixed(0)} pts`

type Point = { x: number; y: number; round: number; total: number }

const buildSmoothPath = (points: Point[]) => {
  if (!points.length) {
    return ''
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const current = points[index]
    const controlX = (prev.x + current.x) / 2
    path += ` C ${controlX} ${prev.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`
  }
  return path
}

export function Standings() {
  const { standings, state } = useGame()

  const previousRankByManager = useMemo(() => {
    const previousTotals = state.managers.map((manager) => {
      const rounds = manager.weeklyPoints
      const total = rounds.slice(0, Math.max(rounds.length - 1, 0)).reduce((sum, score) => sum + score, 0)
      return { id: manager.id, total }
    })

    previousTotals.sort((left, right) => right.total - left.total)

    return previousTotals.reduce((map, manager, index) => {
      map.set(manager.id, index)
      return map
    }, new Map<string, number>())
  }, [state.managers])

  const chartSeries = useMemo(() => {
    const allManagers = standings
    const maxRounds = Math.max(...allManagers.map((manager) => manager.weeklyPoints.length), 1)
    const totals = allManagers.map((manager) => {
      let running = 0
      return manager.weeklyPoints.map((score) => {
        running += score
        return running
      })
    })
    const maxValue = Math.max(...totals.flat(), 1)

    return allManagers.map((manager, index) => {
      let running = 0
      const points: Point[] = manager.weeklyPoints.map((score, roundIndex) => {
        running += score
        const x =
          CHART_PADDING +
          (roundIndex / Math.max(maxRounds - 1, 1)) *
            (CHART_WIDTH - CHART_PADDING * 2)
        const y =
          CHART_HEIGHT -
          CHART_PADDING -
          (running / maxValue) * (CHART_HEIGHT - CHART_PADDING * 2)
        return { x, y, round: roundIndex + 1, total: running }
      })

      return {
        manager,
        stroke: CHART_COLORS[index % CHART_COLORS.length],
        path: buildSmoothPath(points),
        points,
      }
    })
  }, [standings])

  return (
    <section className="view-stack">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Standings</p>
            <h3>Championship ladder</h3>
          </div>
        </div>
        <ol className="ranking-list ranking-list--large">
          {standings.map((manager, index) => {
            const previousRank = previousRankByManager.get(manager.id) ?? index
            const delta = previousRank - index
            return (
              <li key={manager.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{manager.name}</strong>
                  <small>{manager.isHuman ? 'Player' : manager.aiStyle}</small>
                </div>
                <TrendArrow delta={delta} />
                <strong>{formatPoints(manager.totalPoints)}</strong>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Trajectory</p>
            <h3>Cumulative score trace</h3>
          </div>
        </div>
        <div className="chart-shell">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="trend-chart"
            role="img"
            aria-label="Manager points trajectory"
          >
            <rect
              x="0"
              y="0"
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              rx="20"
              className="trend-chart__bg"
            />
            {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
              const y =
                CHART_HEIGHT -
                CHART_PADDING -
                ratio * (CHART_HEIGHT - CHART_PADDING * 2)
              return (
                <line
                  key={ratio}
                  x1={CHART_PADDING}
                  x2={CHART_WIDTH - CHART_PADDING}
                  y1={y}
                  y2={y}
                  className="trend-chart__grid"
                />
              )
            })}

            {chartSeries.map((series) => (
              <g key={series.manager.id}>
                <path
                  d={series.path}
                  fill="none"
                  stroke={series.stroke}
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {series.points.map((point) => (
                  <circle
                    key={`${series.manager.id}-${point.round}`}
                    cx={point.x}
                    cy={point.y}
                    r="4.5"
                    fill={series.stroke}
                  >
                    <title>
                      {series.manager.name} - Round {point.round}: {point.total.toFixed(0)} pts
                    </title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
          <div className="chart-legend">
            {chartSeries.map((series) => (
              <div key={series.manager.id} className="chart-legend__item">
                <span style={{ backgroundColor: series.stroke }} />
                <strong>{series.manager.name}</strong>
                <small>{series.manager.weeklyPoints.length} rounds scored</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {state.isSeasonComplete ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Final classification</p>
              <h3>Season closed</h3>
            </div>
          </div>
          <p className="muted-copy">
            Every historical weekend in the selected dataset has been processed.
            Reset the season to run a fresh management campaign.
          </p>
        </section>
      ) : null}
    </section>
  )
}

