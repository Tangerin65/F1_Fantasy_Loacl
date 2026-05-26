import { useGame } from '../context/useGame'

const topThree = <T,>(items: T[]) => items.slice(0, 3)

export function RaceControl() {
  const { currentRoundData, humanManager, processCurrentRound, state } = useGame()

  if (!humanManager) {
    return null
  }

  const lastRoundResult =
    state.lastProcessedRound >= 0
      ? state.roundResults[state.lastProcessedRound]?.find((entry) => entry.managerId === humanManager.id)
      : null

  return (
    <section className="view-stack">
      <section className="panel panel--spotlight">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Race control</p>
            <h3>{currentRoundData ? currentRoundData.raceName : 'Season complete'}</h3>
          </div>
          <button
            type="button"
            className="action-button"
            onClick={processCurrentRound}
            disabled={!currentRoundData}
          >
            {currentRoundData ? 'Lock & process weekend' : 'No remaining rounds'}
          </button>
        </div>
        {currentRoundData ? (
          <p className="hero-panel__description">
            Run the entire historical weekend using the current lineup, DRS assignment, chip state, and AI strategies.
          </p>
        ) : (
          <p className="muted-copy">The full season has already been resolved.</p>
        )}
      </section>

      {currentRoundData ? (
        <section className="two-column">
          <div className="panel">
            <div className="panel__header">
              <div>
                <p className="panel__kicker">Qualifying preview</p>
                <h3>Front rows</h3>
              </div>
            </div>
            <ol className="ranking-list">
              {topThree(currentRoundData.qualifying.results).map((result) => (
                <li key={result.driver}>
                  <span>{result.position}</span>
                  <div>
                    <strong>{result.driver}</strong>
                    <small>{result.team}</small>
                  </div>
                  <strong>{result.q3 ?? result.q2 ?? result.q1 ?? 'No time'}</strong>
                </li>
              ))}
            </ol>
          </div>

          <div className="panel">
            <div className="panel__header">
              <div>
                <p className="panel__kicker">Race preview</p>
                <h3>Expected podium</h3>
              </div>
            </div>
            <ol className="ranking-list">
              {topThree(currentRoundData.race.results).map((result) => (
                <li key={result.driver}>
                  <span>{result.position}</span>
                  <div>
                    <strong>{result.driver}</strong>
                    <small>Grid {result.grid}</small>
                  </div>
                  <strong>{result.status}</strong>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {currentRoundData?.isSprint ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Sprint session</p>
              <h3>Saturday points race</h3>
            </div>
          </div>
          <ol className="ranking-list">
            {topThree(currentRoundData.sprint?.results ?? []).map((result) => (
              <li key={result.driver}>
                <span>{result.position}</span>
                <div>
                  <strong>{result.driver}</strong>
                  <small>Grid {result.grid}</small>
                </div>
                <strong>{result.points} pts</strong>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Latest report</p>
            <h3>Round breakdown</h3>
          </div>
        </div>
        {lastRoundResult ? (
          <div className="report-grid">
            <article className="report-card">
              <span>Gross</span>
              <strong>{lastRoundResult.grossPoints.toFixed(0)} pts</strong>
            </article>
            <article className="report-card">
              <span>Transfer penalty</span>
              <strong>{lastRoundResult.transferPenalty}</strong>
            </article>
            <article className="report-card">
              <span>Net</span>
              <strong>{lastRoundResult.netPoints.toFixed(0)} pts</strong>
            </article>
          </div>
        ) : (
          <p className="muted-copy">Process the first round to generate a detailed battle report.</p>
        )}

        {lastRoundResult ? (
          <div className="score-table">
            {lastRoundResult.driverScores.map((score) => (
              <div key={score.driver} className="score-row">
                <div>
                  <strong>{score.driver}</strong>
                  <small>
                    Q {score.qualifyingPoints} / S {score.sprintPoints} / R {score.racePoints}
                  </small>
                </div>
                <strong>
                  {score.totalFinal.toFixed(0)} pts {score.drsMultiplier > 1 ? `x${score.drsMultiplier}` : ''}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  )
}
