import { useMemo, useState } from 'react'
import { ChipBadge } from '../components/ChipBadge'
import { ValueChip } from '../components/ValueChip'
import {
  copyText,
  getDriverNumber,
  getRoundActiveDrivers,
  getTeamSurfaceStyle,
  normalizeTeamName,
} from '../lib/presentation'
import { useGame } from '../context/useGame'
import { CHIP_NAMES, MAX_CONSTRUCTORS, MAX_DRIVERS, type ChipType } from '../types'

const formatMoney = (value: number) => `$${value.toFixed(1)}M`
const CHIPS: ChipType[] = ['extraDrs', 'autopilot', 'noNegative', 'limitless', 'wildcard']

type MarketMode = 'driver' | 'constructor'

export function Transfer() {
  const {
    currentRoundData,
    getTransferSummary,
    humanManager,
    replaceConstructor,
    replaceDriver,
    resetHumanLineup,
    setActiveChip,
    setDrsBoostDriver,
    setExtraDrsTargets,
    state,
  } = useGame()

  const [marketMode, setMarketMode] = useState<MarketMode>('driver')
  const [activeDriverSlot, setActiveDriverSlot] = useState(0)
  const [activeConstructorSlot, setActiveConstructorSlot] = useState(0)
  const [showExtraDrsDialog, setShowExtraDrsDialog] = useState(false)
  const [tripleDriverSelection, setTripleDriverSelection] = useState('')
  const [doubleDriverSelection, setDoubleDriverSelection] = useState('')

  const driverMap = useMemo(
    () => new Map(state.drivers.map((driver) => [driver.abbreviation, driver])),
    [state.drivers],
  )
  const constructorMap = useMemo(
    () => new Map(state.constructors.map((constructor) => [constructor.name, constructor])),
    [state.constructors],
  )
  const roundActiveDrivers = useMemo(
    () => getRoundActiveDrivers(currentRoundData),
    [currentRoundData],
  )

  if (!humanManager) {
    return null
  }

  const summary = getTransferSummary(humanManager.id)
  const activeChipName = humanManager.activeChip ? CHIP_NAMES[humanManager.activeChip] : 'None'
  const budgetUsage = Math.min(100, Math.max(0, summary.lineupCost))
  const driverSlots = Array.from(
    { length: MAX_DRIVERS },
    (_, index) => humanManager.drivers[index] ?? '',
  )
  const constructorSlots = Array.from(
    { length: MAX_CONSTRUCTORS },
    (_, index) => humanManager.constructors[index] ?? '',
  )
  const selectedDrivers = new Set(humanManager.drivers)
  const selectedConstructors = new Set(humanManager.constructors)
  const selectedDrsDrivers = humanManager.drivers.filter(Boolean)

  const marketDrivers = [...state.drivers]
    .filter((driver) => roundActiveDrivers.size === 0 || roundActiveDrivers.has(driver.abbreviation))
    .sort((left, right) => right.price - left.price)
  const marketConstructors = [...state.constructors].sort(
    (left, right) => right.price - left.price,
  )

  const openExtraDrsDialog = () => {
    setTripleDriverSelection(humanManager.extraDrsDriver)
    setDoubleDriverSelection(humanManager.drsBoostDriver)
    setShowExtraDrsDialog(true)
  }

  const saveExtraDrsTargets = () => {
    if (!tripleDriverSelection || !doubleDriverSelection || tripleDriverSelection === doubleDriverSelection) {
      return
    }

    setExtraDrsTargets(tripleDriverSelection, doubleDriverSelection)
    setShowExtraDrsDialog(false)
  }

  return (
    <section
      className={`view-stack transfer-shell${
        summary.overBudgetBy > 0 ? ' transfer-shell--warning' : ''
      }`}
    >
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">{copyText('Transfer center', '转会中心')}</p>
            <h3>{copyText('Pick, compare, swap', '挑选、对比、换入')}</h3>
          </div>
          <button type="button" className="secondary-button" onClick={resetHumanLineup}>
            {copyText('Restore pre-race lineup', '恢复到本场赛前阵容')}
          </button>
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
            <strong>
              {copyText('Budget usage', '预算占用')}: {budgetUsage.toFixed(1)}%
            </strong>
            <span>{formatMoney(summary.lineupCost)} / $100.0M</span>
          </div>
        </div>

        <div className="notice-grid">
          <ValueChip
            label={copyText('Budget', '预算')}
            value={
              summary.overBudgetBy > 0
                ? copyText(
                    `Exceeded by ${formatMoney(summary.overBudgetBy)}`,
                    `超出 ${formatMoney(summary.overBudgetBy)}`,
                  )
                : copyText('Cap respected', '预算合法')
            }
            tone={summary.overBudgetBy > 0 ? 'warning' : 'positive'}
          />
          <ValueChip
            label={copyText('Transfers', '转会')}
            value={`${summary.transfersUsed} / ${humanManager.freeTransfers}`}
            tone={summary.penalty < 0 ? 'warning' : 'neutral'}
          />
          <ValueChip
            label={copyText('Active chip', '当前 Chip')}
            value={activeChipName}
            tone="accent"
          />
          <ValueChip
            label={copyText('2X DRS', '2X DRS')}
            value={humanManager.drsBoostDriver || copyText('Not selected', '未选择')}
            tone="accent"
          />
        </div>

        {summary.overBudgetBy > 0 ? (
          <p className="notice-banner">
            {copyText(
              `Budget exceeded by ${formatMoney(summary.overBudgetBy)}`,
              `预算超出 ${formatMoney(summary.overBudgetBy)}`,
            )}
          </p>
        ) : null}
        {summary.penalty < 0 ? (
          <p className="notice-banner notice-banner--subtle">
            {copyText(
              `Extra transfer penalty: ${summary.penalty} pts`,
              `额外转会罚分：${summary.penalty} 分`,
            )}
          </p>
        ) : null}
      </section>

      <section className="split-layout">
        <div className="panel panel--fill">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">{copyText('Current roster', '当前阵容')}</p>
              <h3>{copyText('Swap queue', '待替换槽位')}</h3>
            </div>
          </div>

          <div className="roster-list">
            {driverSlots.map((driverId, index) => {
              const driver = driverMap.get(driverId)
              return (
                <article
                  key={`${driverId || 'empty-driver'}-${index}`}
                  className={`roster-row roster-row--team${
                    marketMode === 'driver' && activeDriverSlot === index ? ' is-selected' : ''
                  }${!driver ? ' roster-row--empty' : ''}`}
                  style={driver ? getTeamSurfaceStyle(driver.team, state.selectedSeason ?? undefined) : undefined}
                >
                  <div>
                    <small>{copyText(`Driver slot ${index + 1}`, `车手槽位 ${index + 1}`)}</small>
                    <strong>
                      {driver ? `${getDriverNumber(driverId)} ${driver.fullName}` : copyText('Empty slot', '空槽位')}
                    </strong>
                    <span>
                      {driver
                        ? `${normalizeTeamName(driver.team, state.selectedSeason ?? undefined)} · ${formatMoney(driver.price)}`
                        : copyText('Pick a driver from the market', '从市场中选择一名车手')}
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
                    {copyText('Pick', '选择')}
                  </button>
                </article>
              )
            })}

            {constructorSlots.map((constructorName, index) => {
              const constructor = constructorMap.get(constructorName)
              return (
                <article
                  key={`${constructorName || 'empty-constructor'}-${index}`}
                  className={`roster-row roster-row--team${
                    marketMode === 'constructor' && activeConstructorSlot === index
                      ? ' is-selected'
                      : ''
                  }${!constructor ? ' roster-row--empty' : ''}`}
                  style={constructor ? getTeamSurfaceStyle(constructor.name, state.selectedSeason ?? undefined) : undefined}
                >
                  <div>
                    <small>{copyText(`Constructor slot ${index + 1}`, `车队槽位 ${index + 1}`)}</small>
                    <strong>{constructor ? normalizeTeamName(constructor.name, state.selectedSeason ?? undefined) : copyText('Empty slot', '空槽位')}</strong>
                    <span>
                      {constructor
                        ? formatMoney(constructor.price)
                        : copyText('Pick a constructor from the market', '从市场中选择一支车队')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setMarketMode('constructor')
                      setActiveConstructorSlot(index)
                    }}
                  >
                    {copyText('Pick', '选择')}
                  </button>
                </article>
              )
            })}
          </div>

          <div className="drs-panel">
            <div className="drs-panel__group">
              <p className="panel__kicker">2X DRS</p>
              <div className="drs-grid">
                {selectedDrsDrivers.length > 0 ? (
                  selectedDrsDrivers.map((driverId) => (
                    <button
                      key={driverId}
                      type="button"
                      className={`drs-pill${
                        humanManager.drsBoostDriver === driverId ? ' is-active' : ''
                      }`}
                      onClick={() => setDrsBoostDriver(driverId)}
                    >
                      {getDriverNumber(driverId)} {driverId}
                    </button>
                  ))
                ) : (
                  <p className="muted-copy">
                    {copyText('Pick drivers before assigning DRS.', '先选择车手，再分配 DRS。')}
                  </p>
                )}
              </div>
            </div>

            {humanManager.activeChip === 'extraDrs' ? (
              <div className="drs-panel__group">
                <p className="panel__kicker">3X DRS</p>
                <div className="drs-panel__summary">
                  <span>
                    3X: {humanManager.extraDrsDriver || '--'} · 2X: {humanManager.drsBoostDriver || '--'}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={openExtraDrsDialog}
                  >
                    {copyText('Adjust targets', '调整目标')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel panel--fill">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">{copyText('Transfer market', '转会市场')}</p>
              <h3>
                {marketMode === 'driver'
                  ? copyText('All drivers', '全部车手')
                  : copyText('All constructors', '全部车队')}
              </h3>
            </div>
            <div className="segmented-control">
              <button
                type="button"
                className={marketMode === 'driver' ? 'is-active' : ''}
                onClick={() => setMarketMode('driver')}
              >
                {copyText('Drivers', '车手')}
              </button>
              <button
                type="button"
                className={marketMode === 'constructor' ? 'is-active' : ''}
                onClick={() => setMarketMode('constructor')}
              >
                {copyText('Constructors', '车队')}
              </button>
            </div>
          </div>

          <div className="market-list market-list--fill">
            {marketMode === 'driver'
              ? marketDrivers.map((driver) => {
                  const isSelected = selectedDrivers.has(driver.abbreviation)
                  const showPriceChange = state.lastProcessedRound >= 0
                  return (
                    <article
                      key={driver.abbreviation}
                      className={`market-row market-row--team${isSelected ? ' is-disabled' : ''}`}
                      style={getTeamSurfaceStyle(driver.team, state.selectedSeason ?? undefined)}
                    >
                      <div>
                        <strong>
                          {getDriverNumber(driver.abbreviation)} {driver.fullName}
                        </strong>
                        <span>
                          {driver.abbreviation} · {normalizeTeamName(driver.team, state.selectedSeason ?? undefined)}
                        </span>
                      </div>
                      <div className="market-row__side">
                        <div className="market-row__price">
                          <strong>{formatMoney(driver.price)}</strong>
                          {showPriceChange && driver.lastPriceChange !== 0 ? (
                            <small className={`price-change${driver.lastPriceChange > 0 ? ' price-change--up' : ' price-change--down'}`}>
                              {driver.lastPriceChange > 0 ? '+' : ''}{driver.lastPriceChange.toFixed(1)}M
                            </small>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => {
                            replaceDriver(activeDriverSlot, driver.abbreviation)
                            if (activeDriverSlot < MAX_DRIVERS - 1) {
                              setActiveDriverSlot(activeDriverSlot + 1)
                            }
                          }}
                          disabled={isSelected}
                        >
                          {isSelected ? copyText('Selected', '已选') : copyText('Swap in', '换入')}
                        </button>
                      </div>
                    </article>
                  )
                })
              : marketConstructors.map((constructor) => {
                  const isSelected = selectedConstructors.has(constructor.name)
                  const showPriceChange = state.lastProcessedRound >= 0
                  return (
                    <article
                      key={constructor.name}
                      className={`market-row market-row--team${isSelected ? ' is-disabled' : ''}`}
                      style={getTeamSurfaceStyle(constructor.name, state.selectedSeason ?? undefined)}
                    >
                      <div>
                        <strong>{normalizeTeamName(constructor.name, state.selectedSeason ?? undefined)}</strong>
                        <span>{copyText('Constructor', '车队')}</span>
                      </div>
                      <div className="market-row__side">
                        <div className="market-row__price">
                          <strong>{formatMoney(constructor.price)}</strong>
                          {showPriceChange && constructor.lastPriceChange !== 0 ? (
                            <small className={`price-change${constructor.lastPriceChange > 0 ? ' price-change--up' : ' price-change--down'}`}>
                              {constructor.lastPriceChange > 0 ? '+' : ''}{constructor.lastPriceChange.toFixed(1)}M
                            </small>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => {
                            replaceConstructor(activeConstructorSlot, constructor.name)
                            if (activeConstructorSlot < MAX_CONSTRUCTORS - 1) {
                              setActiveConstructorSlot(activeConstructorSlot + 1)
                            }
                          }}
                          disabled={isSelected}
                        >
                          {isSelected ? copyText('Selected', '已选') : copyText('Swap in', '换入')}
                        </button>
                      </div>
                    </article>
                  )
                })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">{copyText('Chips panel', 'Chips 面板')}</p>
            <h3>{copyText('Activation pool', '可用 Chip')}</h3>
          </div>
        </div>
        <div className="chip-grid chip-grid--equal">
          {CHIPS.map((chip) => (
            <ChipBadge
              key={chip}
              chip={chip}
              active={humanManager.activeChip === chip}
              available={humanManager.chips[chip]}
              onClick={() => {
                const willActivateExtraDrs =
                  chip === 'extraDrs' && humanManager.activeChip !== 'extraDrs'
                setActiveChip(chip)
                if (willActivateExtraDrs && humanManager.chips.extraDrs) {
                  openExtraDrsDialog()
                }
              }}
            />
          ))}
        </div>
      </section>

      {showExtraDrsDialog ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setShowExtraDrsDialog(false)}>
          <section
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel__header">
              <div>
                <p className="panel__kicker">Extra DRS</p>
                <h3>{copyText('Choose your 3X and 2X drivers', '选择 3X 和 2X 车手')}</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowExtraDrsDialog(false)}
              >
                {copyText('Close', '关闭')}
              </button>
            </div>

            <div className="extra-drs-grid">
              <section className="detail-card">
                <h4>3X DRS</h4>
                <div className="selector-stack">
                  {selectedDrsDrivers.map((driverId) => (
                    <button
                      key={`triple-${driverId}`}
                      type="button"
                      className={`selector-pill${
                        tripleDriverSelection === driverId ? ' is-active' : ''
                      }`}
                      onClick={() => setTripleDriverSelection(driverId)}
                    >
                      {getDriverNumber(driverId)} {driverMap.get(driverId)?.fullName ?? driverId}
                    </button>
                  ))}
                </div>
              </section>

              <section className="detail-card">
                <h4>2X DRS</h4>
                <div className="selector-row">
                  {selectedDrsDrivers.map((driverId) => (
                    <button
                      key={`double-${driverId}`}
                      type="button"
                      className={`selector-pill${
                        doubleDriverSelection === driverId ? ' is-active' : ''
                      }`}
                      onClick={() => setDoubleDriverSelection(driverId)}
                    >
                      {getDriverNumber(driverId)} {driverMap.get(driverId)?.fullName ?? driverId}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            {tripleDriverSelection === doubleDriverSelection ? (
              <p className="notice-banner">
                {copyText(
                  '3X and 2X targets must be different drivers.',
                  '3X 和 2X 必须选择两位不同的车手。',
                )}
              </p>
            ) : null}

            <div className="summary-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowExtraDrsDialog(false)}
              >
                {copyText('Cancel', '取消')}
              </button>
              <button type="button" className="action-button" onClick={saveExtraDrsTargets}>
                {copyText('Save targets', '保存目标')}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
