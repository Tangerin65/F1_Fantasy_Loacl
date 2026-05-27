import { copyText } from '../lib/presentation'
import { useGame } from '../context/useGame'

export function SeasonSummary() {
  const {
    exitToSeasonSelect,
    humanManager,
    restartSeason,
    selectedSeasonEntry,
    standings,
    state,
  } = useGame()

  if (!humanManager || !selectedSeasonEntry) {
    return null
  }

  const finalRank =
    standings.findIndex((manager) => manager.id === humanManager.id) + 1 || standings.length
  const champion = standings[0]
  const bestRound = humanManager.weeklyPoints.reduce(
    (best, score, index) =>
      score > best.score
        ? {
            index,
            score,
          }
        : best,
    { index: 0, score: Number.NEGATIVE_INFINITY },
  )
  const roundsProcessed = state.roundResults.length

  return (
    <section className="view-stack">
      <section className="panel panel--summary">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">
              {copyText('Season summary', '赛季总结')}
            </p>
            <h3>
              {copyText(
                `${selectedSeasonEntry.season} campaign complete`,
                `${selectedSeasonEntry.season} 赛季已结算`,
              )}
            </h3>
          </div>
        </div>

        <div className="summary-grid">
          <article className="summary-card">
            <span>{copyText('Champion', '冠军')}</span>
            <strong>{champion?.name ?? 'N/A'}</strong>
            <small>{champion?.totalPoints.toFixed(0) ?? 0} pts</small>
          </article>
          <article className="summary-card">
            <span>{copyText('Your finish', '你的排名')}</span>
            <strong>P{finalRank}</strong>
            <small>{humanManager.totalPoints.toFixed(0)} pts</small>
          </article>
          <article className="summary-card">
            <span>{copyText('Best round', '最佳单站')}</span>
            <strong>R{bestRound.index + 1}</strong>
            <small>{bestRound.score.toFixed(0)} pts</small>
          </article>
          <article className="summary-card">
            <span>{copyText('Rounds processed', '已处理分站')}</span>
            <strong>{roundsProcessed}</strong>
            <small>{copyText('full weekends', '完整比赛周')}</small>
          </article>
        </div>

        <p className="muted-copy">
          {copyText(
            'Use Exit Game to return to season selection, or start a fresh campaign with the same dataset.',
            '可以结束当前游戏返回选季界面，也可以立刻用同一赛季数据开启新一轮管理。',
          )}
        </p>

        <div className="summary-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={exitToSeasonSelect}
          >
            {copyText('Exit Game', '结束游戏')}
          </button>
          <button
            type="button"
            className="action-button"
            onClick={restartSeason}
          >
            {copyText('New Campaign', '新的赛季')}
          </button>
        </div>
      </section>
    </section>
  )
}
