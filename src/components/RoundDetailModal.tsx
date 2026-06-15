import type { ConstructorRoundScore, DriverRoundScore, RoundData, ScoreBreakdownItem } from '../types'
import {
  copyText,
  getOvertakeLeaders,
  normalizeTeamName,
} from '../lib/presentation'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RoundDetailModalProps {
  roundData: RoundData
  season: number
  selectedAsset: { kind: 'driver' | 'constructor'; id: string; name: string } | null
  onClose: () => void
}

type ExpandedStage = 'qualifying' | 'sprint' | 'race' | 'pitStop'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getStageTotal = (
  score: DriverRoundScore | ConstructorRoundScore,
  stage: ExpandedStage,
) => {
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

export const renderStageBreakdowns = (
  score: DriverRoundScore | ConstructorRoundScore,
  isSprint: boolean,
) => {
  const stages: Exclude<ExpandedStage, null>[] = (
    'totalFinal' in score
      ? ['qualifying', 'sprint', 'race']
      : ['qualifying', 'sprint', 'race', 'pitStop']
  ).filter((stage) => {
    if (stage === 'sprint' && !isSprint) return false
    return (score.breakdown?.[stage]?.length ?? 0) > 0
  })

  if (stages.length === 0) return null

  return (
    <div className="season-score-row__detail">
      {stages.map((stage) => (
        <section key={stage} className="breakdown-detail breakdown-detail--compact">
          <h4>
            {stage === 'qualifying'
              ? copyText('Qualifying', '排位赛')
              : stage === 'sprint'
                ? copyText('Sprint', '冲刺赛')
                : stage === 'race'
                  ? copyText('Race', '正赛')
                  : copyText('Pit stop', '进站')}
            {' · '}
            {getStageTotal(score, stage)} pts
          </h4>
          {renderBreakdownList(score.breakdown![stage])}
        </section>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RoundDetailModal({
  roundData,
  season,
  selectedAsset,
  onClose,
}: RoundDetailModalProps) {
  const isSprint = roundData.isSprint
  const isDriver = selectedAsset?.kind === 'driver'

  /* --- highlight helpers --- */
  const hlDriver = (driverId: string) =>
    isDriver && driverId === selectedAsset.id
  const hlConstructor = (teamName: string) =>
    !isDriver && normalizeTeamName(teamName, season) === selectedAsset.id
  const hlRow = (...checks: boolean[]) =>
    checks.some(Boolean) ? ' detail-table__row--highlighted' : ''

  return (
    <div
      className="overlay-backdrop overlay-backdrop--higher"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="modal-panel modal-panel--wide"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {/* ---- header ---- */}
        <div className="panel__header">
          <div>
            <p className="panel__kicker">
              {copyText(
                `Round ${roundData.round} details`,
                `第 ${roundData.round} 站详情`,
              )}
            </p>
            <h3>{roundData.raceName}</h3>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            {copyText('Close', '关闭')}
          </button>
        </div>

        {/* ---- main tables ---- */}
        <div className="detail-grid">
          {/* Qualifying */}
          <section className="detail-card">
            <h4>{copyText('Qualifying results', '排位赛全结果')}</h4>
            <div className="detail-table">
              {roundData.qualifying.results.map((result) => (
                <div
                  key={`qual-${result.driver}`}
                  className={
                    'detail-table__row' +
                    hlRow(hlDriver(result.driver), hlConstructor(result.team))
                  }
                >
                  <span>P{result.position}</span>
                  <strong>{result.fullName}</strong>
                  <small>{normalizeTeamName(result.team, season)}</small>
                  <span>{result.q3 ?? result.q2 ?? result.q1 ?? result.status}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Race */}
          <section className="detail-card">
            <h4>{copyText('Race results', '正赛全结果')}</h4>
            <div className="detail-table">
              {roundData.race.results.map((result) => (
                <div
                  key={`race-${result.driver}`}
                  className={
                    'detail-table__row' +
                    hlRow(hlDriver(result.driver), hlConstructor(result.team))
                  }
                >
                  <span>P{result.position}</span>
                  <strong>{result.fullName}</strong>
                  <small>
                    {copyText('Grid', '发车位')} {result.grid}
                  </small>
                  <span>{result.status}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Pit stops — top 3 */}
          <section className="detail-card">
            <h4>{copyText('Top pit stops', '最快进站前三')}</h4>
            <div className="detail-table">
              {roundData.race.pitStops.map((stop, index) => (
                <div
                  key={`pit-${stop.constructor}-${index}`}
                  className={
                    'detail-table__row' +
                    hlRow(hlConstructor(stop.constructor))
                  }
                >
                  <span>P{index + 1}</span>
                  <strong>{normalizeTeamName(stop.constructor, season)}</strong>
                  <small>{copyText('Pit crew', '维修区')}</small>
                  <span>{stop.fastestStop.toFixed(3)}s</span>
                </div>
              ))}
            </div>
          </section>

          {/* Overtake leaderboard — top 8 */}
          <section className="detail-card">
            <h4>{copyText('Overtake leaderboard', '超车榜')}</h4>
            <div className="detail-table">
              {getOvertakeLeaders(roundData)
                .slice(0, 8)
                .map((entry) => (
                  <div
                    key={`gain-${entry.driver}`}
                    className={
                      'detail-table__row' +
                      hlRow(hlDriver(entry.driver))
                    }
                  >
                    <span>{entry.driver}</span>
                    <strong>{entry.fullName}</strong>
                    <small>{normalizeTeamName(entry.team, season)}</small>
                    <span>
                      {entry.gained >= 0 ? `+${entry.gained}` : entry.gained}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </div>

        {/* ---- sprint (conditional) ---- */}
        {isSprint && roundData.sprint ? (
          <div className="detail-grid" style={{ marginTop: 16 }}>
            <section className="detail-card">
              <h4>{copyText('Sprint results', '冲刺赛结果')}</h4>
              <div className="detail-table">
                {roundData.sprint.results.map((result) => (
                  <div
                    key={`sprint-${result.driver}`}
                    className={
                      'detail-table__row' +
                      hlRow(hlDriver(result.driver), hlConstructor(result.team))
                    }
                  >
                    <span>P{result.position}</span>
                    <strong>{result.fullName}</strong>
                    <small>
                      {copyText('Grid', '发车位')} {result.grid}
                    </small>
                    <span>{result.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

      </section>
    </div>
  )
}
