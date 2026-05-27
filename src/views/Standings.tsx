import { useMemo, useState } from 'react'
import { TrendArrow } from '../components/TrendArrow'
import { copyText } from '../lib/presentation'
import { useGame } from '../context/useGame'

const CHART_WIDTH = 820
const CHART_HEIGHT = 300
const CHART_PADDING = 30
const CHART_COLORS = ['#45b8ff', '#ff7043', '#22c55e', '#facc15']
const formatPoints = (value: number) => `${value.toFixed(0)} pts`

type Point = { x: number; y: number; round: number; total: number; weekly: number }

type HoveredPoint = {
  manager: string
  round: number
  total: number
  weekly: number
  x: number
  y: number
} | null

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
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint>(null)

  const previousRankByManager = useMemo(() => {
    const previousTotals = state.managers.map((manager) => {
      const rounds = manager.weeklyPoints
      const total = rounds
        .slice(0, Math.max(rounds.length - 1, 0))
        .reduce((sum, score) => sum + score, 0)
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
          (roundIndex / Math.max(maxRounds - 1, 1)) * (CHART_WIDTH - CHART_PADDING * 2)
        const y =
          CHART_HEIGHT -
          CHART_PADDING -
          (running / maxValue) * (CHART_HEIGHT - CHART_PADDING * 2)
        return { x, y, round: roundIndex + 1, total: running, weekly: score }
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
            <p className="panel__kicker">{copyText('Standings', '排行榜')}</p>
            <h3>{copyText('Championship ladder', '赛季积分榜')}</h3>
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
                  <small>{manager.isHuman ? copyText('Player', '玩家') : copyText('AI manager', 'AI 经理')}</small>
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
            <p className="panel__kicker">{copyText('Trajectory', '走势')}</p>
            <h3>{copyText('Cumulative score trace', '累计积分曲线')}</h3>
          </div>
        </div>
        <div className="chart-shell">
          <div className="trend-chart-wrap">
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
                      r="5"
                      fill={series.stroke}
                      onMouseEnter={() =>
                        setHoveredPoint({
                          manager: series.manager.name,
                          round: point.round,
                          total: point.total,
                          weekly: point.weekly,
                          x: point.x,
                          y: point.y,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}
                </g>
              ))}
            </svg>

            {hoveredPoint ? (
              <div
                className="chart-tooltip"
                style={{
                  left: `${(hoveredPoint.x / CHART_WIDTH) * 100}%`,
                  top: `${(hoveredPoint.y / CHART_HEIGHT) * 100}%`,
                }}
              >
                <strong>{hoveredPoint.manager}</strong>
                <span>
                  {copyText('Round', '第')} {hoveredPoint.round}
                </span>
                <small>
                  {copyText('Weekly', '单站')} {hoveredPoint.weekly.toFixed(0)} ·{' '}
                  {copyText('Total', '累计')} {hoveredPoint.total.toFixed(0)}
                </small>
              </div>
            ) : null}
          </div>

          <div className="chart-legend">
            {chartSeries.map((series) => (
              <div key={series.manager.id} className="chart-legend__item">
                <span style={{ backgroundColor: series.stroke }} />
                <strong>{series.manager.name}</strong>
                <small>{formatPoints(series.manager.totalPoints)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {state.isSeasonComplete ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">
                {copyText('Final classification', '最终排名')}
              </p>
              <h3>{copyText('Season closed', '赛季已封盘')}</h3>
            </div>
          </div>
          <p className="muted-copy">
            {copyText(
              'Every historical weekend in the selected dataset has been processed. Use the top action button to open the season wrap-up screen.',
              '所选赛季的所有历史比赛周都已经处理完成。使用顶部按钮进入赛季结算界面。',
            )}
          </p>
        </section>
      ) : null}
    </section>
  )
}
