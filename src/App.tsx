import heroImage from './assets/hero.png'
import './App.css'
import { Navigation } from './components/Navigation'
import { ValueChip } from './components/ValueChip'
import { useGame } from './context/useGame'
import { Dashboard } from './views/Dashboard'
import { Standings } from './views/Standings'
import { Transfer } from './views/Transfer'

function SeasonSelect() {
  const { seasonCatalog, selectSeason } = useGame()

  return (
    <main className="season-select">
      <section className="season-select__hero">
        <div className="season-select__copy">
          <p className="season-select__meta">F1 fantasy local engine</p>
          <h1>Historical season management, rendered as a local race wall.</h1>
          <p>
            Choose an exported FastF1 season to run a full fantasy campaign. A
            built-in development fixture is kept in the catalog so the UI stays
            runnable before real JSON exports exist.
          </p>
        </div>
        <img src={heroImage} alt="" className="season-select__image" />
      </section>

      <section className="season-select__grid">
        {seasonCatalog.map((entry) => (
          <button
            key={`${entry.source}-${entry.season}`}
            type="button"
            className="season-card"
            onClick={() => selectSeason(entry.season)}
          >
            <span>{entry.source === 'json' ? 'Real export' : 'Dev fixture'}</span>
            <strong>{entry.season}</strong>
            <small>{entry.data.rounds.length} rounds available</small>
          </button>
        ))}
      </section>
    </main>
  )
}

function AppShell() {
  const {
    currentRoundData,
    getTransferSummary,
    humanManager,
    processCurrentRound,
    resetSeason,
    selectedSeasonEntry,
    setCurrentView,
    state,
  } = useGame()

  if (!selectedSeasonEntry || !humanManager) {
    return null
  }

  const transferSummary = getTransferSummary(humanManager.id)

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <p>F1 Fantasy</p>
          <strong>{selectedSeasonEntry.season}</strong>
          <small>
            {selectedSeasonEntry.source === 'json' ? 'FastF1 export' : 'Fixture mode'}
          </small>
        </div>

        <Navigation
          currentView={state.currentView}
          onNavigate={(view) => setCurrentView(view)}
        />

        <div className="sidebar-summary">
          <article>
            <span>Round</span>
            <strong>{currentRoundData ? `R${currentRoundData.round}` : 'Done'}</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>{humanManager.totalPoints.toFixed(0)} pts</strong>
          </article>
          <article>
            <span>Bank</span>
            <strong>${humanManager.budget.toFixed(1)}M</strong>
          </article>
        </div>

        <button type="button" className="secondary-button" onClick={resetSeason}>
          Reset season
        </button>
      </aside>

      <section className="app-main">
        <header className="hud-bar">
          <div className="hud-bar__left">
            <ValueChip label="Bank" value={`$${humanManager.budget.toFixed(1)}M`} />
            <ValueChip
              label="Total Points"
              value={`${humanManager.totalPoints.toFixed(0)} pts`}
            />
            <ValueChip
              label="Transfers"
              value={`${transferSummary.transfersUsed}/${humanManager.freeTransfers}`}
              tone={transferSummary.penalty < 0 ? 'warning' : 'neutral'}
            />
          </div>
          <div className="hud-bar__center">
            <span className="hud-pulse" />
            <strong>{selectedSeasonEntry.season} SEASON</strong>
            <small>
              {selectedSeasonEntry.source === 'json' ? 'Real Export' : 'Dev Fixture'}
            </small>
          </div>
          <div className="hud-bar__right">
            <button
              type="button"
              className="action-button"
              onClick={processCurrentRound}
              disabled={!currentRoundData || !transferSummary.canProcess}
            >
              {currentRoundData ? 'Lock & Process Weekend' : 'No Remaining Rounds'}
            </button>
          </div>
        </header>

        <header className="app-header">
          <div>
            <p className="app-header__meta">Historical race wall</p>
            <h1>
              {currentRoundData
                ? `ROUND ${currentRoundData.round}: ${currentRoundData.raceName}`
                : `${selectedSeasonEntry.season} championship complete`}
            </h1>
          </div>
          <div className="app-header__status">
            <span>{currentRoundData?.country ?? 'Final table'}</span>
            <strong>
              {currentRoundData?.date ??
                `${state.seasonData?.rounds.length ?? 0} rounds processed`}
            </strong>
          </div>
        </header>

        {state.currentView === 'dashboard' ? <Dashboard /> : null}
        {state.currentView === 'transfer' ? <Transfer /> : null}
        {state.currentView === 'standings' ? <Standings /> : null}
      </section>
    </main>
  )
}

function App() {
  const { state } = useGame()

  return state.currentView === 'seasonSelect' || !state.selectedSeason ? (
    <SeasonSelect />
  ) : (
    <AppShell />
  )
}

export default App

