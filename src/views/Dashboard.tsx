import { useState, useMemo } from 'react'
import { DriverCard } from '../components/DriverCard'
import { ValueChip } from '../components/ValueChip'
import type { ConstructorRoundScore, DriverRoundScore, RoundData, ScoreBreakdownItem } from '../types'
import {
  copyText,
  formatDriverNameTwoLines,
  getOvertakeLeaders,
  getTeamSurfaceStyle,
  normalizeTeamName,
} from '../lib/presentation'
import { buildConstructorScoreMap, buildDriverScoreMap } from '../context/GameContext'
import { useGame } from '../context/useGame'
import { renderStageBreakdowns } from '../components/RoundDetailModal'

type SelectedAsset =
  | { kind: 'driver'; id: string }
  | { kind: 'constructor'; id: string }
  | null

type SeasonScoreAsset =
  | { kind: 'driver'; id: string; name: string }
  | { kind: 'constructor'; id: string; name: string }
  | null

type DriverExpandedStage = 'qualifying' | 'sprint' | 'race'
type ExpandedStage = DriverExpandedStage | 'pitStop' | null

const isDriverExpandedStage = (stage: ExpandedStage): stage is DriverExpandedStage =>
  stage === 'qualifying' || stage === 'sprint' || stage === 'race'

export const getRaceLabel = (roundData: RoundData) => `R${roundData.round} · ${roundData.raceName}`

const getDriverRoundScore = (roundData: RoundData, driverId: string) =>
  buildDriverScoreMap(roundData).get(driverId) ?? null

const getConstructorRoundScore = (roundData: RoundData, constructorId: string, season: number) =>
  buildConstructorScoreMap(roundData, season).get(constructorId) ?? null

const getStageTotal = (score: DriverRoundScore | ConstructorRoundScore, stage: ExpandedStage) => {
  if (stage === 'qualifying') return score.qualifyingPoints
  if (stage === 'sprint') return score.sprintPoints
  if (stage === 'race') return score.racePoints
  if (stage === 'pitStop' && 'pitStopPoints' in score) return score.pitStopPoints
  return 'totalFinal' in score ? score.totalFinal : score.total
}

const renderBreakdownList = (items: ScoreBreakdownItem[]) => (
  <ul className="breakdown-list">
    {items.map((item, index) => (
      <li key={index} className="breakdown-list__item">
        <span>{copyText(item.label, item.labelZh ?? item.label)}</span>
        <strong>{item.points >= 0 ? `+${item.points}` : `${item.points}`}</strong>
      </li>
    ))}
  </ul>
)

export function Dashboard() {
  const { currentRoundData, humanManager, selectedSeasonEntry, standings, state } = useGame()
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null)
  const [seasonScoreAsset, setSeasonScoreAsset] = useState<SeasonScoreAsset>(null)
  const [showWeekendBreakdown, setShowWeekendBreakdown] = useState(false)
  const [expandedStage, setExpandedStage] = useState<ExpandedStage>(null)
  const [expandedRoundIndex, setExpandedRoundIndex] = useState<number | null>(null)

  if (!humanManager || !selectedSeasonEntry || !state.seasonData) {
    return null
  }

  const season = selectedSeasonEntry.season
  const driverMap = new Map(state.drivers.map((driver) => [driver.abbreviation, driver]))
  const constructorMap = new Map(
    state.constructors.map((constructor) => [constructor.name, constructor]),
  )
  const chipsLeft = Object.values(humanManager.chips).filter(Boolean).length
  const currentRank = standings.findIndex((manager) => manager.id === humanManager.id) + 1

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

  const hasSprint = lastRoundData?.isSprint ?? false
  const openSeasonScore = (asset: Exclude<SeasonScoreAsset, null>) => {
    setSeasonScoreAsset(asset)
    setExpandedRoundIndex(null)
  }

  const seasonScores = useMemo(() => {
    if (!seasonScoreAsset || !state.seasonData) return []
    return state.seasonData.rounds
      .map((roundData, roundIndex) => {
        const roundResult = state.roundResults[roundIndex]
        if (!roundResult) return null
        if (seasonScoreAsset.kind === 'driver') {
          const driverScoreMap = buildDriverScoreMap(roundData)
          const score = driverScoreMap.get(seasonScoreAsset.id)
          return score ? { roundData, roundIndex, score } : null
        } else {
          const constructorScoreMap = buildConstructorScoreMap(roundData, season)
          const score = constructorScoreMap.get(seasonScoreAsset.id)
          return score ? { roundData, roundIndex, score } : null
        }
      })
      .filter(Boolean) as {
      roundData: RoundData
      roundIndex: number
      score: DriverRoundScore | ConstructorRoundScore
    }[]
  }, [seasonScoreAsset, state.seasonData, state.roundResults, season])

  return (
    <section className="view-stack">
      {/* D1: hero panel without the deleted description lines */}
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <p className="hero-panel__meta">
            {selectedSeasonEntry.season} {copyText('season', '赛季')}
          </p>
          <h2>
            {currentRoundData
              ? `ROUND ${currentRoundData.round}: ${currentRoundData.raceName}`
              : copyText(
                  `${selectedSeasonEntry.season} archive replay complete`,
                  `${selectedSeasonEntry.season} 历史赛季重放完成`,
                )}
          </h2>
        </div>
        <div className="metric-grid">
          <ValueChip
            label={copyText('Last Round', '上一场积分')}
            value={lastRoundResult ? lastRoundResult.netPoints.toFixed(0) : '--'}
          />
          <ValueChip
            label={copyText('Total Points', '赛季总积分')}
            value={humanManager.totalPoints.toFixed(0)}
          />
          <ValueChip
            label={copyText('Chips Left', '剩余 Chips')}
            value={`${chipsLeft}`}
            tone="accent"
          />
          <ValueChip
            label={copyText('Current Rank', '当前排名')}
            value={currentRank > 0 ? `P${currentRank}/${standings.length}` : '--'}
          />
        </div>
      </section>

      {/* D2: team-coloured garage cards */}
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
                  title={normalizeTeamName(constructor.name, season)}
                  subtitle={copyText('Constructor', '车队')}
                  price={constructor.price}
                  points={constructor.fantasyPoints}
                  lastScore={constructor.recentScores.at(-1)}
                  recentScores={constructor.recentScores}
                  accent="gold"
                  style={getTeamSurfaceStyle(constructor.name, season)}
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
                  subtitle={normalizeTeamName(driver.team, season)}
                  price={driver.price}
                  points={driver.fantasyPoints}
                  lastScore={driver.recentScores.at(-1)}
                  recentScores={driver.recentScores}
                  accent={isDrs ? 'cyan' : 'red'}
                  tag={isDrs ? '2X' : undefined}
                  style={getTeamSurfaceStyle(driver.team, season)}
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
          {/* D7: removed country name, keep only raceName */}
          {lastRoundData ? (
            <div className="round-chip">
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
                <strong>{lastRoundData.race.pitStops[0] ? normalizeTeamName(lastRoundData.race.pitStops[0].constructor, season) : 'N/A'}</strong>
              </article>
              <article className="report-card">
                <span>{copyText('Driver of the Day', '最佳车手')}</span>
                <strong>
                  {(() => {
                    const dotd = lastRoundData.race.driverOfTheDay
                    if (!dotd) return copyText('Pending', '待补全')
                    const driver = lastRoundData.race.results.find(r => r.driver === dotd)
                    return driver?.fullName ?? dotd
                  })()}
                </strong>
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
              {/* D6: updated button text */}
              <button
                type="button"
                className="action-button weekend-summary__button"
                onClick={() => setShowWeekendBreakdown(true)}
              >
                {copyText('Open full weekend details', '查看完整周末详情')}
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

      {/* D6: reordered weekend breakdown — qualifying + race on top, pit stops + overtakes below, sprint at bottom */}
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
              {/* Qualifying — restored, no longer hidden */}
              <section className="detail-card">
                <h4>{copyText('Qualifying results', '排位赛全结果')}</h4>
                <div className="detail-table">
                  {lastRoundData.qualifying.results.map((result) => (
                    <button
                      key={`qual-${result.driver}`}
                      type="button"
                      className="detail-table__row detail-table__row--button"
                      onClick={() => openSeasonScore({ kind: 'driver', id: result.driver, name: result.fullName })}
                    >
                      <span>P{result.position}</span>
                      <strong>{result.fullName}</strong>
                      <small>{normalizeTeamName(result.team, season)}</small>
                      <span>{result.q3 ?? result.q2 ?? result.q1 ?? result.status}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="detail-card">
                <h4>{copyText('Race results', '正赛全结果')}</h4>
                <div className="detail-table">
                  {lastRoundData.race.results.map((result) => (
                    <button
                      key={`race-${result.driver}`}
                      type="button"
                      className="detail-table__row detail-table__row--button"
                      onClick={() => openSeasonScore({ kind: 'driver', id: result.driver, name: result.fullName })}
                    >
                      <span>P{result.position}</span>
                      <strong>{result.fullName}</strong>
                      <small>{copyText('Grid', '发车位')} {result.grid}</small>
                      <span>{result.status}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Pit stops — now below qualifying + race */}
              <section className="detail-card">
                <h4>{copyText('Top pit stops', '最快进站前三')}</h4>
                <div className="detail-table">
                  {lastRoundData.race.pitStops.map((stop, index) => (
                    <button
                      key={`${stop.constructor}-${index}`}
                      type="button"
                      className="detail-table__row detail-table__row--button"
                      onClick={() => {
                        const constructorName = normalizeTeamName(stop.constructor, season)
                        openSeasonScore({ kind: 'constructor', id: constructorName, name: constructorName })
                      }}
                    >
                      <span>P{index + 1}</span>
                      <strong>{normalizeTeamName(stop.constructor, season)}</strong>
                      <small>{copyText('Pit crew', '维修区')}</small>
                      <span>{stop.fastestStop.toFixed(3)}s</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="detail-card">
                <h4>{copyText('Overtake leaderboard', '超车榜')}</h4>
                <div className="detail-table">
                  {getOvertakeLeaders(lastRoundData)
                    .slice(0, 8)
                    .map((entry) => (
                      <button
                        key={`gain-${entry.driver}`}
                        type="button"
                        className="detail-table__row detail-table__row--button"
                        onClick={() => openSeasonScore({ kind: 'driver', id: entry.driver, name: entry.fullName })}
                      >
                        <span>{entry.driver}</span>
                        <strong>{entry.fullName}</strong>
                        <small>{normalizeTeamName(entry.team, season)}</small>
                        <span>{entry.gained >= 0 ? `+${entry.gained}` : entry.gained}</span>
                      </button>
                    ))}
                </div>
              </section>
            </div>

            {/* Sprint results — conditionally shown at the bottom */}
            {hasSprint && lastRoundData.sprint ? (
              <div className="detail-grid" style={{ marginTop: 16 }}>
                <section className="detail-card">
                  <h4>{copyText('Sprint results', '冲刺赛结果')}</h4>
                  <div className="detail-table">
                    {lastRoundData.sprint.results.map((result) => (
                      <button
                        key={`sprint-${result.driver}`}
                        type="button"
                        className="detail-table__row detail-table__row--button"
                        onClick={() => openSeasonScore({ kind: 'driver', id: result.driver, name: result.fullName })}
                      >
                        <span>P{result.position}</span>
                        <strong>{result.fullName}</strong>
                        <small>{copyText('Grid', '发车位')} {result.grid}</small>
                        <span>{result.status}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {seasonScoreAsset ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => { setSeasonScoreAsset(null); setExpandedRoundIndex(null); }}>
          <section
            className="modal-panel modal-panel--wide"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel__header">
              <div>
                <p className="panel__kicker">
                  {copyText('Season score history', '赛季得分历史')}
                </p>
                <h3>{seasonScoreAsset.name}</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setSeasonScoreAsset(null); setExpandedRoundIndex(null); }}
              >
                {copyText('Close', '关闭')}
              </button>
            </div>

            {seasonScores.length > 0 ? (
              <div className="season-score-list">
                {seasonScores.map(({ roundData, roundIndex, score }) => {
                  const isExpanded = expandedRoundIndex === roundIndex
                  return (
                    <article
                      key={`${seasonScoreAsset.kind}-${seasonScoreAsset.id}-${roundIndex}`}
                      className="season-score-row"
                    >
                      <button
                        type="button"
                        className={`season-score-row__summary${isExpanded ? ' is-expanded' : ''}`}
                        onClick={() =>
                          setExpandedRoundIndex(isExpanded ? null : roundIndex)
                        }
                      >
                        <span>{getRaceLabel(roundData)}</span>
                        <strong>
                          {('totalFinal' in score ? score.totalFinal : score.total).toFixed(0)} pts
                        </strong>
                        <small>
                          Q {score.qualifyingPoints} · S {score.sprintPoints} · R {score.racePoints}
                          {'pitStopPoints' in score ? ` · P ${score.pitStopPoints}` : ''}
                        </small>
                      </button>
                      {isExpanded && score.breakdown
                        ? renderStageBreakdowns(score, roundData.isSprint)
                        : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="muted-copy">
                {copyText('No processed score is available for this asset yet.', '该资产暂无已结算分站得分。')}
              </p>
            )}
          </section>
        </div>
      ) : null}

      {/* D5: score breakdown with expandable stage details */}
      {selectedAsset && assetDetail ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => { setSelectedAsset(null); setExpandedStage(null); }}>
          <section
            className={`modal-panel${hasSprint ? ' modal-panel--wide' : ''}`}
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
                    : normalizeTeamName(selectedAsset.id, season)}
                </h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setSelectedAsset(null); setExpandedStage(null); }}
              >
                {copyText('Close', '关闭')}
              </button>
            </div>

            {driverDetail ? (
              <>
                <div className="summary-grid">
                  <button
                    type="button"
                    className={`summary-card summary-card--clickable${expandedStage === 'qualifying' ? ' is-expanded' : ''}`}
                    onClick={() => setExpandedStage(expandedStage === 'qualifying' ? null : 'qualifying')}
                  >
                    <span>{copyText('Qualifying', '排位赛')}</span>
                    <strong>{driverDetail.qualifyingPoints}</strong>
                  </button>
                  {hasSprint ? (
                    <button
                      type="button"
                      className={`summary-card summary-card--clickable${expandedStage === 'sprint' ? ' is-expanded' : ''}`}
                      onClick={() => setExpandedStage(expandedStage === 'sprint' ? null : 'sprint')}
                    >
                      <span>{copyText('Sprint', '冲刺赛')}</span>
                      <strong>{driverDetail.sprintPoints}</strong>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`summary-card summary-card--clickable${expandedStage === 'race' ? ' is-expanded' : ''}`}
                    onClick={() => setExpandedStage(expandedStage === 'race' ? null : 'race')}
                  >
                    <span>{copyText('Race', '正赛')}</span>
                    <strong>{driverDetail.racePoints}</strong>
                  </button>
                  <article className="summary-card summary-card--final">
                    <span>{copyText('Final', '最终得分')}</span>
                    <strong>{driverDetail.totalFinal.toFixed(0)}</strong>
                  </article>
                </div>
                {isDriverExpandedStage(expandedStage) && driverDetail.breakdown ? (
                  <div className="breakdown-detail">
                    <h4>
                      {expandedStage === 'qualifying' ? copyText('Qualifying detail', '排位赛细则') :
                       expandedStage === 'sprint' ? copyText('Sprint detail', '冲刺赛细则') :
                       copyText('Race detail', '正赛细则')}
                    </h4>
                    {renderBreakdownList(driverDetail.breakdown[expandedStage])}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="summary-grid">
                  <button
                    type="button"
                    className={`summary-card summary-card--clickable${expandedStage === 'qualifying' ? ' is-expanded' : ''}`}
                    onClick={() => setExpandedStage(expandedStage === 'qualifying' ? null : 'qualifying')}
                  >
                    <span>{copyText('Qualifying', '排位赛')}</span>
                    <strong>{constructorDetail?.qualifyingPoints ?? 0}</strong>
                  </button>
                  {hasSprint ? (
                    <button
                      type="button"
                      className={`summary-card summary-card--clickable${expandedStage === 'sprint' ? ' is-expanded' : ''}`}
                      onClick={() => setExpandedStage(expandedStage === 'sprint' ? null : 'sprint')}
                    >
                      <span>{copyText('Sprint', '冲刺赛')}</span>
                      <strong>{constructorDetail?.sprintPoints ?? 0}</strong>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`summary-card summary-card--clickable${expandedStage === 'race' ? ' is-expanded' : ''}`}
                    onClick={() => setExpandedStage(expandedStage === 'race' ? null : 'race')}
                  >
                    <span>{copyText('Race', '正赛')}</span>
                    <strong>{constructorDetail?.racePoints ?? 0}</strong>
                  </button>
                  <button
                    type="button"
                    className={`summary-card summary-card--clickable${expandedStage === 'pitStop' ? ' is-expanded' : ''}`}
                    onClick={() => setExpandedStage(expandedStage === 'pitStop' ? null : 'pitStop')}
                  >
                    <span>{copyText('Pit stop', '进站')}</span>
                    <strong>{constructorDetail?.pitStopPoints ?? 0}</strong>
                  </button>
                </div>
                {expandedStage && constructorDetail?.breakdown ? (
                  <div className="breakdown-detail">
                    <h4>
                      {expandedStage === 'qualifying' ? copyText('Qualifying detail', '排位赛细则') :
                       expandedStage === 'sprint' ? copyText('Sprint detail', '冲刺赛细则') :
                       expandedStage === 'race' ? copyText('Race detail', '正赛细则') :
                       copyText('Pit stop detail', '进站细则')}
                    </h4>
                    {renderBreakdownList(constructorDetail.breakdown[expandedStage])}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
