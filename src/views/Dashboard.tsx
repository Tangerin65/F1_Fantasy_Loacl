import { useState } from 'react'
import { DriverCard } from '../components/DriverCard'
import { ValueChip } from '../components/ValueChip'
import type { ConstructorRoundScore, DriverRoundScore } from '../types'
import {
  copyText,
  formatDriverNameTwoLines,
  getOvertakeLeaders,
} from '../lib/presentation'
import { useGame } from '../context/useGame'

const formatMoney = (value: number) => `$${value.toFixed(1)}M`

type SelectedAsset =
  | { kind: 'driver'; id: string }
  | { kind: 'constructor'; id: string }
  | null

export function Dashboard() {
  const { currentRoundData, humanManager, selectedSeasonEntry, state } = useGame()
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null)
  const [showWeekendBreakdown, setShowWeekendBreakdown] = useState(false)

  if (!humanManager || !selectedSeasonEntry || !state.seasonData) {
    return null
  }

  const driverMap = new Map(state.drivers.map((driver) => [driver.abbreviation, driver]))
  const constructorMap = new Map(
    state.constructors.map((constructor) => [constructor.name, constructor]),
  )
  const chipsLeft = Object.values(humanManager.chips).filter(Boolean).length
  const nextRoundLabel = currentRoundData
    ? `R${currentRoundData.round}`
    : copyText('Season Complete', '赛季已完成')

  const lastRoundData =
    state.lastProcessedRound >= 0
      ? state.seasonData.rounds[state.lastProcessedRound]
      : null
  const lastRoundResult =
    state.lastProcessedRound >= 0
      ? state.roundResults[state.lastProcessedRound]?.find(
          (entry) => entry.managerId === humanManager.id,
        )
      : null
  const marketMovers = [...state.drivers]
    .sort(
      (left, right) =>
        (right.recentScores.at(-1) ?? Number.NEGATIVE_INFINITY) -
        (left.recentScores.at(-1) ?? Number.NEGATIVE_INFINITY),
    )
    .slice(0, 3)
  const assetDetail =
    selectedAsset && lastRoundResult
      ? selectedAsset.kind === 'driver'
        ? lastRoundResult.driverScores.find((score) => score.driver === selectedAsset.id) ?? null
        : lastRoundResult.constructorScores.find(
            (score) => score.constructor === selectedAsset.id,
          ) ?? null
      : null
  const driverDetail =
    selectedAsset?.kind === 'driver' ? (assetDetail as DriverRoundScore | null) : null
  const constructorDetail =
    selectedAsset?.kind === 'constructor'
      ? (assetDetail as ConstructorRoundScore | null)
      : null

  return (
    <section className="view-stack">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <p className="hero-panel__meta">
            {selectedSeasonEntry.season} {copyText('season', '赛季')} ·{' '}
            {selectedSeasonEntry.source === 'json'
              ? copyText('real export', '真实导出')
              : copyText('dev fixture', '开发样例')}
          </p>
          <h2>
            {currentRoundData
              ? `ROUND ${currentRoundData.round}: ${currentRoundData.raceName}`
              : copyText(
                  `${selectedSeasonEntry.season} archive replay complete`,
                  `${selectedSeasonEntry.season} 历史赛季重放完成`,
                )}
          </h2>
          <p className="hero-panel__description">
            {copyText(
              'Load and process each weekend from the top bar. Use the garage below to inspect the previous round score breakdown for every current asset.',
              '通过顶部按钮逐站推进赛季。下方 Garage lineup 中的每位车手和车队都可以直接查看上一站的得分细则。',
            )}
          </p>
        </div>
        <div className="metric-grid">
          <ValueChip
            label={copyText('Total Points', '总积分')}
            value={humanManager.totalPoints.toFixed(0)}
          />
          <ValueChip label="Bank" value={formatMoney(humanManager.budget)} />
          <ValueChip
            label={copyText('Chips Left', '剩余 Chips')}
            value={`${chipsLeft}`}
            tone="accent"
          />
          <ValueChip
            label={copyText('Next Round', '下一站')}
            value={nextRoundLabel}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">{copyText('Garage lineup', 'Garage lineup')}</p>
            <h3>{copyText('Formation view', '当前阵容')}</h3>
          </div>
        </div>

        <div className="garage-grid">
          <div className="garage-grid__row garage-grid__row--constructors">
            {humanManager.constructors.map((constructorName) => {
              const constructor = constructorMap.get(constructorName)
              if (!constructor) {
                return null
              }
              return (
                <DriverCard
                  key={constructor.name}
                  title={constructor.name}
                  subtitle={copyText('Constructor', '车队')}
                  price={constructor.price}
                  points={constructor.fantasyPoints}
                  lastScore={constructor.recentScores.at(-1)}
                  recentScores={constructor.recentScores}
                  accent="gold"
                  highlight={copyText(
                    'Open the last-round point split',
                    '点击查看上一站得分细则',
                  )}
                  onClick={() =>
                    setSelectedAsset({
                      kind: 'constructor',
                      id: constructor.name,
                    })
                  }
                />
              )
            })}
          </div>

          <div className="garage-grid__row garage-grid__row--drivers">
            {humanManager.drivers.map((driverId) => {
              const driver = driverMap.get(driverId)
              if (!driver) {
                return null
              }
              const isDrs = humanManager.drsBoostDriver === driver.abbreviation
              return (
                <DriverCard
                  key={driver.abbreviation}
                  title={formatDriverNameTwoLines(driver.fullName)}
                  subtitle={driver.team}
                  price={driver.price}
                  points={driver.fantasyPoints}
                  lastScore={driver.recentScores.at(-1)}
                  recentScores={driver.recentScores}
                  accent={isDrs ? 'cyan' : 'red'}
                  tag={isDrs ? '2X DRS' : undefined}
                  isDrs={isDrs}
                  highlight={copyText(
                    `Form ${driver.recentScores.length ? driver.recentScores.join(' / ') : 'No rounds yet'}`,
                    `近三站 ${driver.recentScores.length ? driver.recentScores.join(' / ') : '暂无数据'}`,
                  )}
                  onClick={() =>
                    setSelectedAsset({
                      kind: 'driver',
                      id: driver.abbreviation,
                    })
                  }
                />
              )
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">
              {copyText('Weekend summary', 'Weekend summary')}
            </p>
            <h3>
              {lastRoundData
                ? copyText(
                    `Round ${lastRoundData.round} report`,
                    `第 ${lastRoundData.round} 站总结`,
                  )
                : copyText('No processed rounds yet', '尚未处理任何分站')}
            </h3>
          </div>
          {lastRoundData ? (
            <div className="round-chip">
              <span>
                {lastRoundData.country}
              </span>
              <strong>{lastRoundData.raceName}</strong>
            </div>
          ) : null}
        </div>

        {lastRoundData && lastRoundResult ? (
          <>
            <div className="report-grid">
              <article className="report-card">
                <span>{copyText('Podium P1', '冠军')}</span>
                <strong>{lastRoundData.race.results[0]?.fullName ?? 'N/A'}</strong>
              </article>
              <article className="report-card">
                <span>{copyText('Fastest pit team', '最快进站车队')}</span>
                <strong>{lastRoundData.race.pitStops[0]?.constructor ?? 'N/A'}</strong>
              </article>
              <article className="report-card">
                <span>{copyText('DRS return', 'DRS 收益')}</span>
                <strong>
                  {lastRoundResult.driverScores
                    .find((score) => score.drsMultiplier > 1)
                    ?.totalFinal.toFixed(0) ?? 0}{' '}
                  pts
                </strong>
              </article>
              <article className="report-card">
                <span>{copyText('Net weekend', '本站净得分')}</span>
                <strong>{lastRoundResult.netPoints.toFixed(0)} pts</strong>
              </article>
            </div>
            <div className="weekend-summary__footer">
              <div className="market-movers">
                <h4>{copyText('Market movers', '市场热度')}</h4>
                <ul>
                  {marketMovers.map((driver) => (
                    <li key={driver.abbreviation}>
                      <strong>{driver.fullName}</strong>
                      <span>
                        {copyText('Last round', '上一站')} {driver.recentScores.at(-1)?.toFixed(0) ?? 0} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="action-button weekend-summary__button"
                onClick={() => setShowWeekendBreakdown(true)}
              >
                {copyText('Open full weekend breakdown', '查看完整 weekend 详情')}
              </button>
            </div>
          </>
        ) : (
          <p className="muted-copy">
            {copyText(
              'Process the first round to unlock podium, pit-stop, overtake, and score breakdown views.',
              '处理第一站后，这里会解锁领奖台、进站、超车与得分拆解等完整信息。',
            )}
          </p>
        )}
      </section>

      {showWeekendBreakdown && lastRoundData ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setShowWeekendBreakdown(false)}>
          <section
            className="modal-panel modal-panel--wide"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel__header">
              <div>
                <p className="panel__kicker">
                  {copyText('Weekend deep dive', 'Weekend 深度信息')}
                </p>
                <h3>
                  {lastRoundData.raceName}
                </h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowWeekendBreakdown(false)}
              >
                {copyText('Close', '关闭')}
              </button>
            </div>

            <div className="detail-grid">
              <section className="detail-card detail-card--hidden">
                <h4>{copyText('Qualifying results', '排位赛全结果')}</h4>
                <div className="detail-table">
                  {lastRoundData.qualifying.results.map((result) => (
                    <div key={`qual-${result.driver}`} className="detail-table__row">
                      <span>P{result.position}</span>
                      <strong>{result.fullName}</strong>
                      <small>{result.team}</small>
                      <span>{result.q3 ?? result.q2 ?? result.q1 ?? result.status}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-card">
                <h4>{copyText('Race results', '正赛全结果')}</h4>
                <div className="detail-table">
                  {lastRoundData.race.results.map((result) => (
                    <div key={`race-${result.driver}`} className="detail-table__row">
                      <span>P{result.position}</span>
                      <strong>{result.fullName}</strong>
                      <small>{copyText('Grid', '发车位')} {result.grid}</small>
                      <span>{result.status}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-card">
                <h4>{copyText('Top pit stops', '最快进站前三')}</h4>
                <div className="detail-table">
                  {lastRoundData.race.pitStops.map((stop, index) => (
                    <div key={`${stop.constructor}-${index}`} className="detail-table__row">
                      <span>P{index + 1}</span>
                      <strong>{stop.constructor}</strong>
                      <small>{copyText('Pit crew', '维修区')}</small>
                      <span>{stop.fastestStop.toFixed(3)}s</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-card">
                <h4>{copyText('Overtake leaderboard', '超车榜')}</h4>
                <div className="detail-table">
                  {getOvertakeLeaders(lastRoundData)
                    .slice(0, 8)
                    .map((entry) => (
                      <div key={`gain-${entry.driver}`} className="detail-table__row">
                        <span>{entry.driver}</span>
                        <strong>{entry.fullName}</strong>
                        <small>{entry.team}</small>
                        <span>{entry.gained >= 0 ? `+${entry.gained}` : entry.gained}</span>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {selectedAsset && assetDetail ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setSelectedAsset(null)}>
          <section
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel__header">
              <div>
                <p className="panel__kicker">
                  {copyText('Last round breakdown', '上一站得分拆解')}
                </p>
                <h3>
                  {selectedAsset.kind === 'driver'
                    ? driverMap.get(selectedAsset.id)?.fullName ?? selectedAsset.id
                    : selectedAsset.id}
                </h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedAsset(null)}
              >
                {copyText('Close', '关闭')}
              </button>
            </div>

            {driverDetail ? (
              <div className="summary-grid">
                <article className="summary-card">
                  <span>{copyText('Qualifying', '排位赛')}</span>
                  <strong>{driverDetail.qualifyingPoints}</strong>
                </article>
                <article className="summary-card">
                  <span>{copyText('Sprint', '冲刺赛')}</span>
                  <strong>{driverDetail.sprintPoints}</strong>
                </article>
                <article className="summary-card">
                  <span>{copyText('Race', '正赛')}</span>
                  <strong>{driverDetail.racePoints}</strong>
                </article>
                <article className="summary-card">
                  <span>{copyText('Final', '最终得分')}</span>
                  <strong>
                    {driverDetail.totalFinal.toFixed(0)}
                  </strong>
                </article>
              </div>
            ) : (
              <div className="summary-grid">
                <article className="summary-card">
                  <span>{copyText('Qualifying', '排位赛')}</span>
                  <strong>{constructorDetail?.qualifyingPoints ?? 0}</strong>
                </article>
                <article className="summary-card">
                  <span>{copyText('Sprint', '冲刺赛')}</span>
                  <strong>{constructorDetail?.sprintPoints ?? 0}</strong>
                </article>
                <article className="summary-card">
                  <span>{copyText('Race', '正赛')}</span>
                  <strong>{constructorDetail?.racePoints ?? 0}</strong>
                </article>
                <article className="summary-card">
                  <span>{copyText('Pit stop', '进站')}</span>
                  <strong>{constructorDetail?.pitStopPoints ?? 0}</strong>
                </article>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
