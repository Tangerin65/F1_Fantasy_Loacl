import { useMemo, useState } from 'react'
import { TrendArrow } from '../components/TrendArrow'
import { copyText, getDriverNumber, normalizeTeamName } from '../lib/presentation'
import { useGame } from '../context/useGame'

const CHART_WIDTH = 820
const CHART_HEIGHT = 300
const CHART_PADDING = 30
const CHART_COLORS = ['#45b8ff', '#ff7043', '#22c55e', '#facc15']
const formatPoints = (value: number) => `${value.toFixed(0)} pts`

type Point = { x: number; y: number; round: number; total: number; weekly: number }

type HoveredPoint = {
  manager: string
  raceName: string
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
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)

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
    const allValues = totals.flat()
    const maxValue = Math.max(...allValues, 1)
    const minValue = Math.min(...allValues, 0)
    const valueRange = maxValue - minValue || 1
    const zeroY =
      CHART_HEIGHT -
      CHART_PADDING -
      ((0 - minValue) / valueRange) * (CHART_HEIGHT - CHART_PADDING * 2)

    const series = allManagers.map((manager, index) => {
      let running = 0
      const points: Point[] = manager.weeklyPoints.map((score, roundIndex) => {
        running += score
        const x =
          CHART_PADDING +
          (roundIndex / Math.max(maxRounds - 1, 1)) * (CHART_WIDTH - CHART_PADDING * 2)
        const y =
          CHART_HEIGHT -
          CHART_PADDING -
          ((running - minValue) / valueRange) * (CHART_HEIGHT - CHART_PADDING * 2)
        return { x, y, round: roundIndex + 1, total: running, weekly: score }
      })

      return {
        manager,
        stroke: CHART_COLORS[index % CHART_COLORS.length],
        path: buildSmoothPath(points),
        points,
      }
    })

    return { series, zeroY }
  }, [standings])

  const selectedManager = selectedManagerId
    ? state.managers.find((manager) => manager.id === selectedManagerId) ?? null
    : null
  const lastResult =
    selectedManager && state.lastProcessedRound >= 0
      ? state.roundResults[state.lastProcessedRound]?.find(
          (entry) => entry.managerId === selectedManager.id,
        ) ?? null
      : null
  const lastRoundData =
    state.lastProcessedRound >= 0 ? state.seasonData?.rounds[state.lastProcessedRound] : null
  const driverMap = new Map(state.drivers.map((driver) => [driver.abbreviation, driver]))

  return (
    <section className="view-stack">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">{copyText('Standings', '积分榜')}</p>
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
                <button
                  type="button"
                  className="ranking-list__manager"
                  onClick={() => setSelectedManagerId(manager.id)}
                >
                  <strong>{manager.name}</strong>
                  <small>{manager.isHuman ? copyText('Player', '玩家') : copyText('AI manager', 'AI 经理')}</small>
                </button>
                <TrendArrow delta={delta} />
                <strong className="ranking-list__score">{formatPoints(manager.totalPoints)}</strong>
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

              {/* Zero baseline */}
              <line
                x1={CHART_PADDING}
                x2={CHART_WIDTH - CHART_PADDING}
                y1={chartSeries.zeroY}
                y2={chartSeries.zeroY}
                className="trend-chart__zero"
              />

              {chartSeries.series.map((series) => (
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
                          raceName:
                            state.seasonData?.rounds[point.round - 1]?.raceName ??
                            `Round ${point.round}`,
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
                <span>{hoveredPoint.raceName}</span>
                <small>
                  {copyText('Weekly', '单站')} {hoveredPoint.weekly.toFixed(0)} ·{' '}
                  {copyText('Total', '累计')} {hoveredPoint.total.toFixed(0)}
                </small>
              </div>
            ) : null}
          </div>

          <div className="chart-legend">
            {chartSeries.series.map((series) => (
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

      {selectedManager ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setSelectedManagerId(null)}>
          <section
            className="modal-panel modal-panel--wide"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel__header">
              <div>
                <p className="panel__kicker">
                  {lastRoundData?.raceName ?? copyText('No processed round', '尚无已结算分站')}
                </p>
                <h3>
                  {selectedManager.name} ·{' '}
                  {selectedManager.isHuman ? copyText('Player lineup', '玩家阵容') : copyText('AI manager lineup', 'AI 经理阵容')}
                </h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedManagerId(null)}
              >
                {copyText('Close', '关闭')}
              </button>
            </div>

            {lastResult ? (
              <>
                <div className="summary-grid">
                  <article className="summary-card">
                    <span>{copyText('Chip used', '使用 Chip')}</span>
                    <strong>{lastResult.chipApplied ? lastResult.chipApplied : copyText('None', '无')}</strong>
                  </article>
                  <article className="summary-card">
                    <span>{copyText('Gross points', '原始得分')}</span>
                    <strong>{formatPoints(lastResult.grossPoints)}</strong>
                  </article>
                  <article className="summary-card">
                    <span>{copyText('Transfer penalty', '转会罚分')}</span>
                    <strong>{formatPoints(lastResult.transferPenalty)}</strong>
                  </article>
                  <article className="summary-card">
                    <span>{copyText('Net points', '净得分')}</span>
                    <strong>{formatPoints(lastResult.netPoints)}</strong>
                  </article>
                </div>

                <div className="detail-grid manager-breakdown">
                  <section className="detail-card">
                    <h4>{copyText('Driver scoring', '车手得分')}</h4>
                    <div className="detail-table">
                      {lastResult.driverScores.map((score) => (
                        <div key={score.driver} className="detail-table__row">
                          <span>{getDriverNumber(score.driver)}</span>
                          <strong>{driverMap.get(score.driver)?.fullName ?? score.driver}</strong>
                          <small>
                            <span className="score-breakdown-tags">
                              <span>Q {score.qualifyingPoints}</span>
                              <span>S {score.sprintPoints}</span>
                              <span>R {score.racePoints}</span>
                            </span>
                          </small>
                          <span>
                            {score.totalFinal.toFixed(0)}
                            {score.drsMultiplier > 1 ? ` (${score.drsMultiplier}X)` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="detail-card">
                    <h4>{copyText('Constructor scoring', '车队得分')}</h4>
                    <div className="detail-table">
                      {lastResult.constructorScores.map((score) => (
                        <div key={score.constructor} className="detail-table__row">
                          <span>{copyText('Team', '车队')}</span>
                          <strong>{normalizeTeamName(score.constructor, state.selectedSeason ?? undefined)}</strong>
                          <small>
                            <span className="score-breakdown-tags">
                              <span>Q {score.qualifyingPoints}</span>
                              <span>S {score.sprintPoints}</span>
                              <span>R {score.racePoints}</span>
                              <span>P {score.pitStopPoints}</span>
                            </span>
                          </small>
                          <span>{score.total.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <p className="muted-copy">
                {copyText(
                  'Process a race weekend to unlock the last-race lineup and scoring breakdown.',
                  '结算一个比赛周后，可以查看上一站阵容和详细得分构成。',
                )}
              </p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
