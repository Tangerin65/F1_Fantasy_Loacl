import { DriverCard } from '../components/DriverCard'
import { ValueChip } from '../components/ValueChip'
import { useGame } from '../context/useGame'

const formatMoney = (value: number) => `$${value.toFixed(1)}M`

export function Dashboard() {
  const { currentRoundData, humanManager, selectedSeasonEntry, state } = useGame()

  if (!humanManager || !selectedSeasonEntry || !state.seasonData) {
    return null
  }

  const driverMap = new Map(state.drivers.map((driver) => [driver.abbreviation, driver]))
  const constructorMap = new Map(
    state.constructors.map((constructor) => [constructor.name, constructor]),
  )
  const chipsLeft = Object.values(humanManager.chips).filter(Boolean).length
  const nextRoundLabel = currentRoundData
    ? `Round ${currentRoundData.round}`
    : 'Season Complete'

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

  return (
    <section className="view-stack">
      <section className="hero-panel panel--track">
        <div className="hero-panel__copy">
          <p className="hero-panel__meta">
            {selectedSeasonEntry.season} season -{' '}
            {selectedSeasonEntry.source === 'json' ? 'real export' : 'dev fixture'}
          </p>
          <h2>
            {currentRoundData
              ? `ROUND ${currentRoundData.round}: ${currentRoundData.raceName}`
              : `${selectedSeasonEntry.season} archive replay complete`}
          </h2>
          <p className="hero-panel__description">
            Lock your lineup and process the weekend from the top control bar. Live
            summary and roster form update immediately after each round.
          </p>
        </div>
        <div className="metric-grid">
          <ValueChip label="Total Points" value={humanManager.totalPoints.toFixed(0)} />
          <ValueChip label="Bank" value={formatMoney(humanManager.budget)} />
          <ValueChip label="Chips Left" value={`${chipsLeft}`} tone="accent" />
          <ValueChip label="Next Round" value={nextRoundLabel} />
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Weekend summary</p>
            <h3>{lastRoundData ? `Round ${lastRoundData.round} report` : 'No processed rounds yet'}</h3>
          </div>
          {lastRoundData ? (
            <div className="round-chip">
              <span>{lastRoundData.country}</span>
              <strong>{lastRoundData.raceName}</strong>
            </div>
          ) : null}
        </div>

        {lastRoundData && lastRoundResult ? (
          <>
            <div className="report-grid">
              <article className="report-card">
                <span>Podium P1</span>
                <strong>{lastRoundData.race.results[0]?.driver ?? 'N/A'}</strong>
              </article>
              <article className="report-card">
                <span>Fastest pit team</span>
                <strong>{lastRoundData.race.pitStops[0]?.constructor ?? 'N/A'}</strong>
              </article>
              <article className="report-card">
                <span>DRS return</span>
                <strong>{lastRoundResult.driverScores.find((s) => s.drsMultiplier > 1)?.totalFinal.toFixed(0) ?? 0} pts</strong>
              </article>
              <article className="report-card">
                <span>Net weekend</span>
                <strong>{lastRoundResult.netPoints.toFixed(0)} pts</strong>
              </article>
            </div>
            <div className="market-movers">
              <h4>Market movers</h4>
              <ul>
                {marketMovers.map((driver) => (
                  <li key={driver.abbreviation}>
                    <strong>{driver.fullName}</strong>
                    <span>
                      Last round {driver.recentScores.at(-1)?.toFixed(0) ?? 0} pts
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="muted-copy">
            Process the first round using the top HUD button to generate podium,
            DRS returns, and market mover analytics.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Garage lineup</p>
            <h3>Formation view</h3>
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
                  subtitle="Constructor"
                  price={constructor.price}
                  points={constructor.fantasyPoints}
                  recentScores={constructor.recentScores}
                  accent="gold"
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
                  title={driver.fullName}
                  subtitle={driver.team}
                  price={driver.price}
                  points={driver.fantasyPoints}
                  recentScores={driver.recentScores}
                  accent={isDrs ? 'cyan' : 'red'}
                  tag={isDrs ? '2X DRS' : undefined}
                  isDrs={isDrs}
                  highlight={`Form ${driver.recentScores.length ? driver.recentScores.join(' / ') : 'No rounds yet'}`}
                />
              )
            })}
          </div>
        </div>
      </section>
    </section>
  )
}
