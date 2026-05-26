import { DriverCard } from '../components/DriverCard'
import { useGame } from '../context/useGame'

const formatMoney = (value: number) => `$${value.toFixed(1)}M`

export function Dashboard() {
  const { currentRoundData, humanManager, selectedSeasonEntry, state, standings } = useGame()

  if (!humanManager || !selectedSeasonEntry) {
    return null
  }

  const driverMap = new Map(state.drivers.map((driver) => [driver.abbreviation, driver]))
  const constructorMap = new Map(state.constructors.map((constructor) => [constructor.name, constructor]))
  const chipsLeft = Object.values(humanManager.chips).filter(Boolean).length

  return (
    <section className="view-stack">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <p className="hero-panel__meta">
            {selectedSeasonEntry.season} season · {selectedSeasonEntry.source === 'json' ? 'real export' : 'dev fixture'}
          </p>
          <h2>Garage overview</h2>
          <p className="hero-panel__description">
            Track squad value, bank, chip inventory, and the next historical weekend before you lock the round.
          </p>
        </div>
        <div className="metric-grid">
          <article className="metric-card">
            <span>Total points</span>
            <strong>{humanManager.totalPoints.toFixed(0)}</strong>
          </article>
          <article className="metric-card">
            <span>Bank</span>
            <strong>{formatMoney(humanManager.budget)}</strong>
          </article>
          <article className="metric-card">
            <span>Chips left</span>
            <strong>{chipsLeft}</strong>
          </article>
          <article className="metric-card">
            <span>Next round</span>
            <strong>{currentRoundData ? `R${currentRoundData.round}` : 'Complete'}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Upcoming weekend</p>
            <h3>{currentRoundData ? currentRoundData.raceName : 'Season complete'}</h3>
          </div>
          {currentRoundData ? (
            <div className="round-chip">
              <span>{currentRoundData.country}</span>
              <strong>{currentRoundData.date}</strong>
            </div>
          ) : null}
        </div>
        {currentRoundData ? (
          <div className="event-grid">
            <article className="event-card">
              <span>Weekend format</span>
              <strong>{currentRoundData.isSprint ? 'Sprint' : 'Standard'}</strong>
            </article>
            <article className="event-card">
              <span>Fastest pit lane</span>
              <strong>{currentRoundData.race.pitStops[0]?.constructor ?? 'N/A'}</strong>
            </article>
            <article className="event-card">
              <span>Fastest lap watch</span>
              <strong>{currentRoundData.race.fastestLapDriver}</strong>
            </article>
          </div>
        ) : (
          <p className="muted-copy">All rounds have been processed. Move to the standings view for the final table.</p>
        )}
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Driver lineup</p>
              <h3>Five active seats</h3>
            </div>
          </div>
          <div className="asset-grid">
            {humanManager.drivers.map((driverId) => {
              const driver = driverMap.get(driverId)
              if (!driver) {
                return null
              }

              return (
                <DriverCard
                  key={driver.abbreviation}
                  title={driver.fullName}
                  subtitle={driver.team}
                  price={driver.price}
                  points={driver.fantasyPoints}
                  tag={humanManager.drsBoostDriver === driver.abbreviation ? 'DRS' : undefined}
                  highlight={`Recent form ${driver.recentScores.length ? driver.recentScores.join(' / ') : 'No rounds yet'}`}
                />
              )
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Constructor lineup</p>
              <h3>Factory wall</h3>
            </div>
          </div>
          <div className="asset-grid asset-grid--compact">
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
                  highlight={`Recent form ${constructor.recentScores.length ? constructor.recentScores.join(' / ') : 'No rounds yet'}`}
                />
              )
            })}
          </div>

          <div className="standings-mini">
            <div className="panel__header">
              <div>
                <p className="panel__kicker">League snapshot</p>
                <h3>Current order</h3>
              </div>
            </div>
            <ol className="ranking-list">
              {standings.map((manager, index) => (
                <li key={manager.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{manager.name}</strong>
                    <small>{manager.weeklyPoints.at(-1)?.toFixed(0) ?? 0} last round</small>
                  </div>
                  <strong>{manager.totalPoints.toFixed(0)}</strong>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </section>
  )
}
