import { useMemo } from 'react'
import { useGame } from '../context/useGame'

const CHART_WIDTH = 640
const CHART_HEIGHT = 240
const CHART_PADDING = 28
const CHART_COLORS = ['#e10600', '#17f5c3', '#f4d03f', '#4da3ff']

const formatPoints = (value: number) => `${value.toFixed(0)} pts`

export function Standings() {
  const { standings, state } = useGame()

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
      const points = manager.weeklyPoints.map((score, roundIndex) => {
        running += score
        const x =
          CHART_PADDING +
          (roundIndex / Math.max(maxRounds - 1, 1)) * (CHART_WIDTH - CHART_PADDING * 2)
        const y =
          CHART_HEIGHT -
          CHART_PADDING -
          (running / maxValue) * (CHART_HEIGHT - CHART_PADDING * 2)
        return `${x},${y}`
      })

      return {
        manager,
        stroke: CHART_COLORS[index % CHART_COLORS.length],
        polyline: points.join(' '),
        endPoint: points.at(-1),
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
          {standings.map((manager, index) => (
            <li key={manager.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{manager.name}</strong>
                <small>{manager.isHuman ? 'Player' : manager.aiStyle}</small>
              </div>
              <strong>{formatPoints(manager.totalPoints)}</strong>
            </li>
          ))}
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
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="trend-chart" role="img" aria-label="Manager points trajectory">
            <rect x="0" y="0" width={CHART_WIDTH} height={CHART_HEIGHT} rx="20" className="trend-chart__bg" />
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = CHART_HEIGHT - CHART_PADDING - ratio * (CHART_HEIGHT - CHART_PADDING * 2)
              return <line key={ratio} x1={CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y1={y} y2={y} className="trend-chart__grid" />
            })}
            {chartSeries.map((series) => (
              <g key={series.manager.id}>
                <polyline
                  fill="none"
                  stroke={series.stroke}
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={series.polyline}
                />
                {series.endPoint ? (
                  <circle
                    cx={series.endPoint.split(',')[0]}
                    cy={series.endPoint.split(',')[1]}
                    r="5"
                    fill={series.stroke}
                  />
                ) : null}
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
            Every historical weekend in the selected dataset has been processed. Reset the season to run a fresh management campaign.
          </p>
        </section>
      ) : null}
    </section>
  )
}
