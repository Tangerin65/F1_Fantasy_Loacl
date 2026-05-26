import { ChipBadge } from '../components/ChipBadge'
import { useGame } from '../context/useGame'
import { CHIP_NAMES, type ChipType } from '../types'

const formatMoney = (value: number) => `$${value.toFixed(1)}M`

const CHIPS: ChipType[] = ['extraDrs', 'autopilot', 'noNegative', 'limitless', 'wildcard', 'finalFix']

export function Transfer() {
  const {
    getTransferSummary,
    humanManager,
    replaceConstructor,
    replaceDriver,
    setActiveChip,
    setDrsBoostDriver,
    state,
  } = useGame()

  if (!humanManager) {
    return null
  }

  const summary = getTransferSummary(humanManager.id)
  const driversByTeam = [...state.drivers].sort((left, right) => right.price - left.price)
  const constructorsByPrice = [...state.constructors].sort((left, right) => right.price - left.price)
  const activeChipName = humanManager.activeChip ? CHIP_NAMES[humanManager.activeChip] : 'None'

  return (
    <section className="view-stack">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Transfer center</p>
            <h3>Budget, swaps, and weekly boosts</h3>
          </div>
          <div className="status-strip">
            <span>Lineup value {formatMoney(summary.lineupCost)}</span>
            <span>Bank {formatMoney(summary.remainingBudget)}</span>
            <span>Penalty {summary.penalty}</span>
            <span>Chip {activeChipName}</span>
          </div>
        </div>

        <div className="notice-grid">
          <article className={`notice-card${summary.overBudgetBy > 0 ? ' is-warning' : ''}`}>
            <span>Budget</span>
            <strong>
              {summary.overBudgetBy > 0
                ? `Over by ${formatMoney(summary.overBudgetBy)}`
                : 'Cap respected'}
            </strong>
          </article>
          <article className={`notice-card${summary.penalty < 0 ? ' is-warning' : ''}`}>
            <span>Transfers</span>
            <strong>
              {summary.transfersUsed} used / {humanManager.freeTransfers} free
            </strong>
          </article>
          <article className="notice-card">
            <span>DRS target</span>
            <strong>{humanManager.drsBoostDriver}</strong>
          </article>
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Drivers</p>
              <h3>Five-seat roster</h3>
            </div>
          </div>
          <div className="roster-editor">
            {humanManager.drivers.map((driverId, index) => (
              <label key={`${driverId}-${index}`} className="editor-row">
                <span className="editor-row__label">Driver slot {index + 1}</span>
                <select
                  value={driverId}
                  onChange={(event) => replaceDriver(index, event.target.value)}
                >
                  {driversByTeam.map((driver) => (
                    <option key={driver.abbreviation} value={driver.abbreviation}>
                      {driver.abbreviation} · {driver.fullName} · {driver.team} · {formatMoney(driver.price)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="drs-grid">
            {humanManager.drivers.map((driverId) => (
              <button
                key={driverId}
                type="button"
                className={`drs-pill${humanManager.drsBoostDriver === driverId ? ' is-active' : ''}`}
                onClick={() => setDrsBoostDriver(driverId)}
              >
                {driverId}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Constructors</p>
              <h3>Factory pair</h3>
            </div>
          </div>
          <div className="roster-editor">
            {humanManager.constructors.map((constructorName, index) => (
              <label key={`${constructorName}-${index}`} className="editor-row">
                <span className="editor-row__label">Constructor slot {index + 1}</span>
                <select
                  value={constructorName}
                  onChange={(event) => replaceConstructor(index, event.target.value)}
                >
                  {constructorsByPrice.map((constructor) => (
                    <option key={constructor.name} value={constructor.name}>
                      {constructor.name} · {formatMoney(constructor.price)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="chip-grid">
            {CHIPS.map((chip) => (
              <ChipBadge
                key={chip}
                chip={chip}
                active={humanManager.activeChip === chip}
                available={humanManager.chips[chip]}
                onClick={() => setActiveChip(chip)}
              />
            ))}
          </div>
        </div>
      </section>
    </section>
  )
}
