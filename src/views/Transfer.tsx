import { useMemo, useState } from 'react'
import { ChipBadge } from '../components/ChipBadge'
import { ValueChip } from '../components/ValueChip'
import { useGame } from '../context/useGame'
import { CHIP_NAMES, type ChipType } from '../types'

const formatMoney = (value: number) => `$${value.toFixed(1)}M`
const CHIPS: ChipType[] = [
  'extraDrs',
  'autopilot',
  'noNegative',
  'limitless',
  'wildcard',
  'finalFix',
]

type MarketMode = 'driver' | 'constructor'

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

  const [marketMode, setMarketMode] = useState<MarketMode>('driver')
  const [activeDriverSlot, setActiveDriverSlot] = useState(0)
  const [activeConstructorSlot, setActiveConstructorSlot] = useState(0)

  const driverMap = useMemo(
    () => new Map(state.drivers.map((driver) => [driver.abbreviation, driver])),
    [state.drivers],
  )
  const constructorMap = useMemo(
    () => new Map(state.constructors.map((constructor) => [constructor.name, constructor])),
    [state.constructors],
  )

  const marketDrivers = [...state.drivers].sort((left, right) => right.price - left.price)
  const marketConstructors = [...state.constructors].sort(
    (left, right) => right.price - left.price,
  )

  if (!humanManager) {
    return null
  }

  const summary = getTransferSummary(humanManager.id)
  const activeChipName = humanManager.activeChip ? CHIP_NAMES[humanManager.activeChip] : 'None'
  const budgetUsage = Math.min(100, Math.max(0, (summary.lineupCost / 100) * 100))

  return (
    <section
      className={`view-stack transfer-shell${
        summary.overBudgetBy > 0 ? ' transfer-shell--warning' : ''
      }`}
    >
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Transfer center</p>
            <h3>Pick, compare, swap</h3>
          </div>
          <div className="status-strip">
            <span>Lineup value {formatMoney(summary.lineupCost)}</span>
            <span>Bank {formatMoney(summary.remainingBudget)}</span>
            <span>Penalty {summary.penalty}</span>
            <span>Chip {activeChipName}</span>
          </div>
        </div>

        <div className="budget-meter">
          <div className="budget-meter__rail">
            <div
              className="budget-meter__fill"
              style={{ width: `${budgetUsage}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="budget-meter__meta">
            <strong>Budget usage: {budgetUsage.toFixed(1)}%</strong>
            <span>{formatMoney(summary.lineupCost)} / $100.0M</span>
          </div>
        </div>

        <div className="notice-grid">
          <ValueChip
            label="Budget"
            value={
              summary.overBudgetBy > 0
                ? `Exceeded by ${formatMoney(summary.overBudgetBy)}`
                : 'Cap respected'
            }
            tone={summary.overBudgetBy > 0 ? 'warning' : 'positive'}
          />
          <ValueChip
            label="Transfers"
            value={`${summary.transfersUsed} used / ${humanManager.freeTransfers} free`}
            tone={summary.penalty < 0 ? 'warning' : 'neutral'}
          />
          <ValueChip label="DRS target" value={humanManager.drsBoostDriver} tone="accent" />
          <ValueChip label="Transfer penalty" value={`${summary.penalty} pts`} tone={summary.penalty < 0 ? 'warning' : 'neutral'} />
        </div>

        {summary.overBudgetBy > 0 ? (
          <p className="notice-banner">
            Budget Exceeded by {formatMoney(summary.overBudgetBy)}
          </p>
        ) : null}
        {summary.penalty < 0 ? (
          <p className="notice-banner notice-banner--subtle">
            Extra Transfer Penalty: {summary.penalty} pts
          </p>
        ) : null}
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Current roster</p>
              <h3>Swap queue</h3>
            </div>
          </div>

          <div className="roster-list">
            {humanManager.drivers.map((driverId, index) => {
              const driver = driverMap.get(driverId)
              return (
                <article
                  key={`${driverId}-${index}`}
                  className={`roster-row${
                    marketMode === 'driver' && activeDriverSlot === index ? ' is-selected' : ''
                  }`}
                >
                  <div>
                    <small>Driver slot {index + 1}</small>
                    <strong>{driver?.fullName ?? driverId}</strong>
                    <span>
                      {driver?.team ?? 'Unknown'} - {formatMoney(driver?.price ?? 0)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setMarketMode('driver')
                      setActiveDriverSlot(index)
                    }}
                  >
                    Swap
                  </button>
                </article>
              )
            })}

            {humanManager.constructors.map((constructorName, index) => {
              const constructor = constructorMap.get(constructorName)
              return (
                <article
                  key={`${constructorName}-${index}`}
                  className={`roster-row${
                    marketMode === 'constructor' && activeConstructorSlot === index
                      ? ' is-selected'
                      : ''
                  }`}
                >
                  <div>
                    <small>Constructor slot {index + 1}</small>
                    <strong>{constructor?.name ?? constructorName}</strong>
                    <span>{formatMoney(constructor?.price ?? 0)}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setMarketMode('constructor')
                      setActiveConstructorSlot(index)
                    }}
                  >
                    Swap
                  </button>
                </article>
              )
            })}
          </div>

          <div className="drs-grid">
            {humanManager.drivers.map((driverId) => (
              <button
                key={driverId}
                type="button"
                className={`drs-pill${
                  humanManager.drsBoostDriver === driverId ? ' is-active' : ''
                }`}
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
              <p className="panel__kicker">Transfer market</p>
              <h3>{marketMode === 'driver' ? 'All drivers' : 'All constructors'}</h3>
            </div>
            <div className="segmented-control">
              <button
                type="button"
                className={marketMode === 'driver' ? 'is-active' : ''}
                onClick={() => setMarketMode('driver')}
              >
                Drivers
              </button>
              <button
                type="button"
                className={marketMode === 'constructor' ? 'is-active' : ''}
                onClick={() => setMarketMode('constructor')}
              >
                Constructors
              </button>
            </div>
          </div>

          <div className="market-list">
            {marketMode === 'driver'
              ? marketDrivers.map((driver) => (
                  <article key={driver.abbreviation} className="market-row">
                    <div>
                      <strong>{driver.fullName}</strong>
                      <span>
                        {driver.abbreviation} - {driver.team}
                      </span>
                    </div>
                    <div className="market-row__side">
                      <strong>{formatMoney(driver.price)}</strong>
                      <button
                        type="button"
                        className="action-button"
                        onClick={() => replaceDriver(activeDriverSlot, driver.abbreviation)}
                      >
                        Swap in
                      </button>
                    </div>
                  </article>
                ))
              : marketConstructors.map((constructor) => (
                  <article key={constructor.name} className="market-row">
                    <div>
                      <strong>{constructor.name}</strong>
                      <span>Constructor</span>
                    </div>
                    <div className="market-row__side">
                      <strong>{formatMoney(constructor.price)}</strong>
                      <button
                        type="button"
                        className="action-button"
                        onClick={() => replaceConstructor(activeConstructorSlot, constructor.name)}
                      >
                        Swap in
                      </button>
                    </div>
                  </article>
                ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Chips panel</p>
            <h3>Activation pool</h3>
          </div>
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
      </section>
    </section>
  )
}
