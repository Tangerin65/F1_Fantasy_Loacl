import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getRoundActiveDrivers } from '../lib/presentation'
import {
  ALL_CHIPS_AVAILABLE,
  FREE_TRANSFERS_PER_ROUND,
  INITIAL_BUDGET,
  MAX_CONSTRUCTORS,
  MAX_DRIVERS,
  MAX_FREE_TRANSFERS,
  PRICE_CEILING,
  PRICE_FLOOR,
  PRICE_MAX_CHANGE,
  TRANSFER_PENALTY,
  type AIStyle,
  type ChipType,
  type ConstructorAsset,
  type ConstructorRoundScore,
  type DriverAsset,
  type DriverRoundScore,
  type GameState,
  type GameView,
  type ManagerRoundResult,
  type ManagerTeam,
  type RaceResult,
  type RoundData,
  type SeasonData,
  type SprintResult,
} from '../types'
import { buildInitialConstructors, buildInitialDrivers } from '../data/initial_assets'
import { getSeasonCatalog, type SeasonCatalogEntry } from '../data/seasonCatalog'

interface TransferSummary {
  transfersUsed: number
  penalty: number
  lineupCost: number
  remainingBudget: number
  overBudgetBy: number
  canIgnoreBudget: boolean
  canProcess: boolean
  isSeasonOpener: boolean
}

interface PerformanceSnapshot {
  driverAverages: Map<string, number>
  driverPointsPerMillion: Map<string, number>
  driverGainAverage: Map<string, number>
  constructorAverages: Map<string, number>
}

interface GameContextValue {
  state: GameState
  seasonCatalog: SeasonCatalogEntry[]
  selectedSeasonEntry: SeasonCatalogEntry | null
  currentRoundData: RoundData | null
  humanManager: ManagerTeam | null
  standings: ManagerTeam[]
  selectSeason: (season: number) => void
  exitToSeasonSelect: () => void
  restartSeason: () => void
  resetSeason: () => void
  setCurrentView: (view: GameView) => void
  replaceDriver: (slotIndex: number, driver: string) => void
  replaceConstructor: (slotIndex: number, constructorName: string) => void
  setDrsBoostDriver: (driver: string) => void
  setExtraDrsTargets: (tripleDriver: string, doubleDriver: string) => void
  setActiveChip: (chip: ChipType | null) => void
  processCurrentRound: () => void
  getTransferSummary: (managerId: string) => TransferSummary
}

const seasonCatalog = getSeasonCatalog()

const createEmptyState = (): GameState => ({
  selectedSeason: null,
  seasonData: null,
  currentRound: 0,
  drivers: [],
  constructors: [],
  managers: [],
  currentView: 'seasonSelect',
  isSeasonComplete: false,
  lastProcessedRound: -1,
  roundResults: [],
})

const GameContext = createContext<GameContextValue | null>(null)

const QUALIFYING_POINTS = new Map(
  Array.from({ length: 10 }, (_, index) => [index + 1, 10 - index]),
)
const SPRINT_POINTS = new Map(
  Array.from({ length: 8 }, (_, index) => [index + 1, 8 - index]),
)
const RACE_POINTS = new Map([
  [1, 25],
  [2, 18],
  [3, 15],
  [4, 12],
  [5, 10],
  [6, 8],
  [7, 6],
  [8, 4],
  [9, 2],
  [10, 1],
])

const FANATIC_TEAMS = new Set(['Red Bull Racing', 'Ferrari', 'McLaren', 'Mercedes'])
const CHAOS_TRACKS = new Set(['Azerbaijan', 'Singapore', 'Monaco', 'China'])

const roundToTenth = (value: number) => Number(value.toFixed(1))
const clampPrice = (value: number) =>
  roundToTenth(Math.max(PRICE_FLOOR, Math.min(PRICE_CEILING, value)))

const isFinishedStatus = (status: string) =>
  status === 'Finished' || status.startsWith('+') || status.includes('Lap')

const isDsqStatus = (status: string) => status.toUpperCase().includes('DSQ')

const getQualifyingPositionPoints = (position: number) =>
  QUALIFYING_POINTS.get(position) ?? 0

const getSprintPositionPoints = (position: number) => SPRINT_POINTS.get(position) ?? 0

const getRacePositionPoints = (position: number) => RACE_POINTS.get(position) ?? 0

const getPositionDeltaPoints = (grid: number, position: number) => {
  const delta = grid - position
  return delta < 0 ? Math.max(delta, -10) : delta
}

const computePendingTransfers = (current: string[], baseline: string[] | undefined) => {
  if (!baseline?.length) {
    return 0
  }

  const baselineSet = new Set(baseline)
  return current.filter((item) => !baselineSet.has(item)).length
}

const getDriversMap = (drivers: DriverAsset[]) => new Map(drivers.map((driver) => [driver.abbreviation, driver]))
const getConstructorsMap = (constructors: ConstructorAsset[]) =>
  new Map(constructors.map((constructor) => [constructor.name, constructor]))

const resolveExtraDrsTargets = (
  drivers: string[],
  currentDoubleDriver?: string,
  currentTripleDriver?: string,
) => {
  const fallbackDriver = drivers[0] ?? ''
  let doubleDriver =
    currentDoubleDriver && drivers.includes(currentDoubleDriver)
      ? currentDoubleDriver
      : fallbackDriver
  let tripleDriver =
    currentTripleDriver && drivers.includes(currentTripleDriver)
      ? currentTripleDriver
      : doubleDriver

  if (tripleDriver === doubleDriver) {
    tripleDriver = drivers.find((driver) => driver !== doubleDriver) ?? doubleDriver
  }

  if (doubleDriver === tripleDriver) {
    doubleDriver = drivers.find((driver) => driver !== tripleDriver) ?? tripleDriver
  }

  return {
    drsBoostDriver: doubleDriver,
    extraDrsDriver: tripleDriver,
  }
}

const getManagerCost = (
  manager: ManagerTeam,
  driversMap: Map<string, DriverAsset>,
  constructorsMap: Map<string, ConstructorAsset>,
) => {
  const driverCost = manager.drivers.reduce(
    (sum, driver) => sum + (driversMap.get(driver)?.price ?? 0),
    0,
  )
  const constructorCost = manager.constructors.reduce(
    (sum, constructor) => sum + (constructorsMap.get(constructor)?.price ?? 0),
    0,
  )

  return roundToTenth(driverCost + constructorCost)
}

const syncBudget = (
  manager: ManagerTeam,
  driversMap: Map<string, DriverAsset>,
  constructorsMap: Map<string, ConstructorAsset>,
): ManagerTeam => ({
  ...manager,
  budget: roundToTenth(INITIAL_BUDGET - getManagerCost(manager, driversMap, constructorsMap)),
})

const createTransferSummary = (
  manager: ManagerTeam,
  driversMap: Map<string, DriverAsset>,
  constructorsMap: Map<string, ConstructorAsset>,
  isSeasonOpener = false,
): TransferSummary => {
  const transfersUsed =
    computePendingTransfers(manager.drivers, manager.lockedDrivers) +
    computePendingTransfers(manager.constructors, manager.lockedConstructors)
  const canIgnoreBudget = manager.activeChip === 'limitless' || manager.activeChip === 'finalFix'
  const freeAllowance =
    isSeasonOpener
      ? Number.POSITIVE_INFINITY
      : manager.activeChip === 'wildcard' || manager.activeChip === 'limitless'
      ? Number.POSITIVE_INFINITY
      : manager.freeTransfers + (manager.activeChip === 'finalFix' ? 1 : 0)
  const penaltyTransfers =
    Number.isFinite(freeAllowance) && transfersUsed > freeAllowance
      ? transfersUsed - freeAllowance
      : 0
  const lineupCost = getManagerCost(manager, driversMap, constructorsMap)
  const remainingBudget = roundToTenth(INITIAL_BUDGET - lineupCost)
  const overBudgetBy = remainingBudget < 0 ? roundToTenth(Math.abs(remainingBudget)) : 0

  return {
    transfersUsed,
    penalty: penaltyTransfers * TRANSFER_PENALTY,
    lineupCost,
    remainingBudget,
    overBudgetBy,
    canIgnoreBudget,
    canProcess: (remainingBudget >= 0 || canIgnoreBudget) &&
      manager.drivers.length === MAX_DRIVERS &&
      manager.constructors.length === MAX_CONSTRUCTORS,
    isSeasonOpener,
  }
}

const scoreQualifyingDriver = (result: RoundData['qualifying']['results'][number]) => {
  if (isDsqStatus(result.status)) {
    return -5
  }

  if (!result.q1 && !isFinishedStatus(result.status)) {
    return -5
  }

  return getQualifyingPositionPoints(result.position)
}

const getQualifyingConstructorBonus = (
  results: RoundData['qualifying']['results'],
  constructorName: string,
) => {
  const constructorResults = results.filter((entry) => entry.team === constructorName)
  const q2Count = constructorResults.filter((entry) => Boolean(entry.q2)).length
  const q3Count = constructorResults.filter((entry) => Boolean(entry.q3)).length

  if (q3Count === 2) {
    return 10
  }

  if (q3Count === 1) {
    return 5
  }

  if (q2Count === 2) {
    return 3
  }

  if (q2Count === 1) {
    return 1
  }

  return -1
}

const scoreSprintDriver = (
  result: SprintResult,
  fastestLapDriver: string | undefined,
) => {
  const positionPoints = getSprintPositionPoints(result.position)
  const movementPoints = getPositionDeltaPoints(result.grid, result.position)
  const fastestLapPoints = result.driver === fastestLapDriver ? 5 : 0
  const dnfPenalty = !isFinishedStatus(result.status) ? -10 : 0

  return positionPoints + movementPoints + fastestLapPoints + dnfPenalty
}

const scoreRaceDriver = (result: RaceResult, fastestLapDriver: string) => {
  const positionPoints = getRacePositionPoints(result.position)
  const movementPoints = getPositionDeltaPoints(result.grid, result.position)
  const fastestLapPoints = result.driver === fastestLapDriver ? 10 : 0
  const retirementPenalty = isDsqStatus(result.status)
    ? -20
    : !isFinishedStatus(result.status)
      ? -20
      : 0

  return {
    total: positionPoints + movementPoints + fastestLapPoints + retirementPenalty,
    withoutFastestLap: positionPoints + movementPoints + retirementPenalty,
    fastestLapPoints,
  }
}

const buildDriverScoreMap = (roundData: RoundData) => {
  const qualifyingMap = new Map(
    roundData.qualifying.results.map((entry) => [entry.driver, scoreQualifyingDriver(entry)]),
  )

  const sprintMap = new Map(
    (roundData.sprint?.results ?? []).map((entry) => [
      entry.driver,
      scoreSprintDriver(entry, roundData.sprint?.fastestLapDriver),
    ]),
  )

  const raceMap = new Map(
    roundData.race.results.map((entry) => [entry.driver, scoreRaceDriver(entry, roundData.race.fastestLapDriver)]),
  )

  return roundData.race.results.reduce((map, result) => {
    const qualifyingPoints = qualifyingMap.get(result.driver) ?? 0
    const sprintPoints = sprintMap.get(result.driver) ?? 0
    const racePoints = raceMap.get(result.driver)?.total ?? 0
    map.set(result.driver, {
      driver: result.driver,
      qualifyingPoints,
      sprintPoints,
      racePoints,
      totalRaw: qualifyingPoints + sprintPoints + racePoints,
      drsMultiplier: 1,
      totalFinal: qualifyingPoints + sprintPoints + racePoints,
    })
    return map
  }, new Map<string, DriverRoundScore>())
}

const buildConstructorScoreMap = (roundData: RoundData) => {
  const constructorScores = new Map<string, ConstructorRoundScore>()

  for (const qualifyingResult of roundData.qualifying.results) {
    const current = constructorScores.get(qualifyingResult.team) ?? {
      constructor: qualifyingResult.team,
      qualifyingPoints: 0,
      sprintPoints: 0,
      racePoints: 0,
      pitStopPoints: 0,
      total: 0,
    }
    current.qualifyingPoints += getQualifyingPositionPoints(qualifyingResult.position)
    constructorScores.set(qualifyingResult.team, current)
  }

  for (const [constructorName, score] of constructorScores) {
    score.qualifyingPoints += getQualifyingConstructorBonus(roundData.qualifying.results, constructorName)
  }

  if (roundData.sprint) {
    for (const sprintResult of roundData.sprint.results) {
      const current = constructorScores.get(sprintResult.team) ?? {
        constructor: sprintResult.team,
        qualifyingPoints: 0,
        sprintPoints: 0,
        racePoints: 0,
        pitStopPoints: 0,
        total: 0,
      }
      current.sprintPoints += scoreSprintDriver(sprintResult, roundData.sprint.fastestLapDriver)
      constructorScores.set(sprintResult.team, current)
    }
  }

  const pitStopPoints = new Map(
    roundData.race.pitStops.slice(0, 3).map((entry, index) => [
      entry.constructor,
      [15, 10, 5][index] ?? 0,
    ]),
  )

  for (const raceResult of roundData.race.results) {
    const current = constructorScores.get(raceResult.team) ?? {
      constructor: raceResult.team,
      qualifyingPoints: 0,
      sprintPoints: 0,
      racePoints: 0,
      pitStopPoints: 0,
      total: 0,
    }
    current.racePoints += scoreRaceDriver(raceResult, roundData.race.fastestLapDriver).withoutFastestLap
    current.pitStopPoints = pitStopPoints.get(raceResult.team) ?? current.pitStopPoints
    constructorScores.set(raceResult.team, current)
  }

  for (const score of constructorScores.values()) {
    score.total =
      score.qualifyingPoints + score.sprintPoints + score.racePoints + score.pitStopPoints
  }

  return constructorScores
}

const buildOpeningRoster = (
  drivers: DriverAsset[],
  constructors: ConstructorAsset[],
  performance: PerformanceSnapshot,
  style: AIStyle | 'balanced',
) => {
  const driverCandidates = [...drivers]
  const constructorCandidates = [...constructors]

  const driverScore = (driver: DriverAsset) => {
    const average = performance.driverAverages.get(driver.abbreviation) ?? 0
    const ppm = performance.driverPointsPerMillion.get(driver.abbreviation) ?? 0
    const gains = performance.driverGainAverage.get(driver.abbreviation) ?? 0

    if (style === 'fanatic') {
      return average * 1.3 + driver.price * 0.8 + (FANATIC_TEAMS.has(driver.team) ? 16 : 0)
    }

    if (style === 'value') {
      return ppm * 22 + average * 1.6 - driver.price * 0.15
    }

    if (style === 'underdog') {
      return average * 0.9 + gains * 6 + Math.max(0, 15 - driver.price) * 0.7
    }

    return average * 1.4 + ppm * 10 - driver.price * 0.1
  }

  const constructorScore = (constructor: ConstructorAsset) => {
    const average = performance.constructorAverages.get(constructor.name) ?? 0
    if (style === 'fanatic') {
      return average * 1.25 + constructor.price * 0.7 + (FANATIC_TEAMS.has(constructor.name) ? 14 : 0)
    }

    if (style === 'value') {
      return average * 1.4 - constructor.price * 0.15
    }

    if (style === 'underdog') {
      return average + Math.max(0, 16 - constructor.price) * 0.9
    }

    return average * 1.2 - constructor.price * 0.1
  }

  driverCandidates.sort((left, right) => driverScore(right) - driverScore(left))
  constructorCandidates.sort((left, right) => constructorScore(right) - constructorScore(left))

  let bestPlan:
    | {
        drivers: string[]
        constructors: string[]
        score: number
      }
    | undefined

  for (let leftIndex = 0; leftIndex < constructorCandidates.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < constructorCandidates.length; rightIndex += 1) {
      const selectedConstructors = [
        constructorCandidates[leftIndex],
        constructorCandidates[rightIndex],
      ]
      const constructorCost =
        selectedConstructors[0].price + selectedConstructors[1].price
      if (constructorCost >= INITIAL_BUDGET) {
        continue
      }

      const selectedDrivers: DriverAsset[] = []
      let remainingBudget = INITIAL_BUDGET - constructorCost

      for (const driver of driverCandidates) {
        if (selectedDrivers.length === MAX_DRIVERS) {
          break
        }

        const remainingSlots = MAX_DRIVERS - selectedDrivers.length - 1
        const cheapestRemainder = driverCandidates
          .filter((candidate) => !selectedDrivers.includes(candidate) && candidate.abbreviation !== driver.abbreviation)
          .slice(-remainingSlots)
          .reduce((sum, candidate) => sum + candidate.price, 0)

        if (driver.price <= remainingBudget - cheapestRemainder) {
          selectedDrivers.push(driver)
          remainingBudget -= driver.price
        }
      }

      if (selectedDrivers.length !== MAX_DRIVERS) {
        continue
      }

      const totalScore =
        selectedDrivers.reduce((sum, driver) => sum + driverScore(driver), 0) +
        selectedConstructors.reduce((sum, constructor) => sum + constructorScore(constructor), 0)

      if (!bestPlan || totalScore > bestPlan.score) {
        bestPlan = {
          drivers: selectedDrivers.map((driver) => driver.abbreviation),
          constructors: selectedConstructors.map((constructor) => constructor.name),
          score: totalScore,
        }
      }
    }
  }

  if (bestPlan) {
    return bestPlan
  }

  return {
    drivers: driverCandidates.slice(0, MAX_DRIVERS).map((driver) => driver.abbreviation),
    constructors: constructorCandidates.slice(0, MAX_CONSTRUCTORS).map((constructor) => constructor.name),
    score: 0,
  }
}

const getPerformanceSnapshot = (
  seasonData: SeasonData,
  drivers: DriverAsset[],
  constructors: ConstructorAsset[],
  lastProcessedRound: number,
): PerformanceSnapshot => {
  const processedRounds = seasonData.rounds.slice(0, lastProcessedRound + 1)
  const driverAverages = new Map<string, number>()
  const driverPointsPerMillion = new Map<string, number>()
  const driverGainAverage = new Map<string, number>()
  const constructorAverages = new Map<string, number>()

  for (const driver of drivers) {
    const recentAverage =
      driver.recentScores.reduce((sum, score) => sum + score, 0) /
      Math.max(1, driver.recentScores.length)
    driverAverages.set(driver.abbreviation, recentAverage)
    driverPointsPerMillion.set(
      driver.abbreviation,
      recentAverage / Math.max(driver.price, 1),
    )

    if (!processedRounds.length) {
      driverGainAverage.set(driver.abbreviation, 0)
      continue
    }

    const gains = processedRounds.reduce((collection, round) => {
      const result = round.race.results.find((entry) => entry.driver === driver.abbreviation)
      if (result) {
        collection.push(result.grid - result.position)
      }
      return collection
    }, [] as number[])

    const gainAverage = gains.reduce((sum, gain) => sum + gain, 0) / Math.max(1, gains.length)
    driverGainAverage.set(driver.abbreviation, gainAverage)
  }

  for (const constructor of constructors) {
    const average =
      constructor.recentScores.reduce((sum, score) => sum + score, 0) /
      Math.max(1, constructor.recentScores.length)
    constructorAverages.set(constructor.name, average)
  }

  return {
    driverAverages,
    driverPointsPerMillion,
    driverGainAverage,
    constructorAverages,
  }
}

const initializeManagers = (seasonData: SeasonData, drivers: DriverAsset[], constructors: ConstructorAsset[]) => {
  const performance = getPerformanceSnapshot(seasonData, drivers, constructors, -1)
  const balancedRoster = buildOpeningRoster(drivers, constructors, performance, 'balanced')
  const fanaticRoster = buildOpeningRoster(drivers, constructors, performance, 'fanatic')
  const valueRoster = buildOpeningRoster(drivers, constructors, performance, 'value')
  const underdogRoster = buildOpeningRoster(drivers, constructors, performance, 'underdog')

  const driverMap = getDriversMap(drivers)
  const constructorMap = getConstructorsMap(constructors)

  const baseManagers: ManagerTeam[] = [
    {
      id: 'human',
      name: 'You',
      isHuman: true,
      drivers: balancedRoster.drivers,
      constructors: balancedRoster.constructors,
      drsBoostDriver: balancedRoster.drivers[0],
      extraDrsDriver: balancedRoster.drivers[1] ?? balancedRoster.drivers[0],
      activeChip: null,
      chips: { ...ALL_CHIPS_AVAILABLE },
      totalPoints: 0,
      weeklyPoints: [],
      budget: 0,
      freeTransfers: FREE_TRANSFERS_PER_ROUND,
      lockedDrivers: undefined,
      lockedConstructors: undefined,
    },
    {
      id: 'fanatic',
      name: 'The Fanatic',
      isHuman: false,
      aiStyle: 'fanatic',
      drivers: fanaticRoster.drivers,
      constructors: fanaticRoster.constructors,
      drsBoostDriver: fanaticRoster.drivers[0],
      extraDrsDriver: fanaticRoster.drivers[1] ?? fanaticRoster.drivers[0],
      activeChip: null,
      chips: { ...ALL_CHIPS_AVAILABLE },
      totalPoints: 0,
      weeklyPoints: [],
      budget: 0,
      freeTransfers: FREE_TRANSFERS_PER_ROUND,
      lockedDrivers: undefined,
      lockedConstructors: undefined,
    },
    {
      id: 'value',
      name: 'Value Trader',
      isHuman: false,
      aiStyle: 'value',
      drivers: valueRoster.drivers,
      constructors: valueRoster.constructors,
      drsBoostDriver: valueRoster.drivers[0],
      extraDrsDriver: valueRoster.drivers[1] ?? valueRoster.drivers[0],
      activeChip: null,
      chips: { ...ALL_CHIPS_AVAILABLE },
      totalPoints: 0,
      weeklyPoints: [],
      budget: 0,
      freeTransfers: FREE_TRANSFERS_PER_ROUND,
      lockedDrivers: undefined,
      lockedConstructors: undefined,
    },
    {
      id: 'underdog',
      name: 'Underdog',
      isHuman: false,
      aiStyle: 'underdog',
      drivers: underdogRoster.drivers,
      constructors: underdogRoster.constructors,
      drsBoostDriver: underdogRoster.drivers[0],
      extraDrsDriver: underdogRoster.drivers[1] ?? underdogRoster.drivers[0],
      activeChip: null,
      chips: { ...ALL_CHIPS_AVAILABLE },
      totalPoints: 0,
      weeklyPoints: [],
      budget: 0,
      freeTransfers: FREE_TRANSFERS_PER_ROUND,
      lockedDrivers: undefined,
      lockedConstructors: undefined,
    },
  ]

  return baseManagers.map((manager) => syncBudget(manager, driverMap, constructorMap))
}

const initializeStateForSeason = (entry: SeasonCatalogEntry): GameState => {
  const drivers = buildInitialDrivers(entry.data)
  const constructors = buildInitialConstructors(entry.data)
  const managers = initializeManagers(entry.data, drivers, constructors)

  return {
    selectedSeason: entry.season,
    seasonData: entry.data,
    currentRound: 0,
    drivers,
    constructors,
    managers,
    currentView: 'dashboard',
    isSeasonComplete: false,
    lastProcessedRound: -1,
    roundResults: [],
  }
}

const applyAiStrategy = (
  manager: ManagerTeam,
  seasonData: SeasonData,
  roundData: RoundData,
  drivers: DriverAsset[],
  constructors: ConstructorAsset[],
  lastProcessedRound: number,
) => {
  if (!manager.aiStyle) {
    return manager
  }

  const performance = getPerformanceSnapshot(seasonData, drivers, constructors, lastProcessedRound)
  const roster = buildOpeningRoster(drivers, constructors, performance, manager.aiStyle)
  const driverMap = getDriversMap(drivers)
  const constructorMap = getConstructorsMap(constructors)
  const candidateDrivers = roster.drivers
  const topDriver = [...candidateDrivers]
    .sort((left, right) => (driverMap.get(right)?.price ?? 0) - (driverMap.get(left)?.price ?? 0))[0]
  const secondaryDriver = candidateDrivers.find((driver) => driver !== topDriver) ?? topDriver

  let activeChip: ChipType | null = null
  const transferCount =
    computePendingTransfers(candidateDrivers, manager.lockedDrivers) +
    computePendingTransfers(roster.constructors, manager.lockedConstructors)

  if (
    manager.aiStyle === 'value' &&
    manager.chips.wildcard &&
    transferCount > manager.freeTransfers
  ) {
    activeChip = 'wildcard'
  } else if (
    manager.aiStyle === 'fanatic' &&
    manager.chips.extraDrs &&
    (performance.driverAverages.get(topDriver) ?? 0) > 20
  ) {
    activeChip = 'extraDrs'
  } else if (
    manager.aiStyle === 'underdog' &&
    manager.chips.noNegative &&
    (CHAOS_TRACKS.has(roundData.country) ||
      candidateDrivers.some((driver) => (performance.driverGainAverage.get(driver) ?? 0) > 2))
  ) {
    activeChip = 'noNegative'
  } else if (
    manager.chips.autopilot &&
    manager.aiStyle !== 'fanatic' &&
    (performance.driverAverages.get(topDriver) ?? 0) < 18
  ) {
    activeChip = 'autopilot'
  }

  const nextManager = syncBudget(
    {
      ...manager,
      drivers: candidateDrivers,
      constructors: roster.constructors,
      drsBoostDriver: activeChip === 'extraDrs' ? secondaryDriver : topDriver,
      extraDrsDriver: activeChip === 'extraDrs' ? topDriver : secondaryDriver,
      activeChip,
    },
    driverMap,
    constructorMap,
  )

  return nextManager
}

const adjustPrices = <TAsset extends DriverAsset | ConstructorAsset>(
  assets: TAsset[],
  kind: 'driver' | 'constructor',
) =>
  assets.map((asset) => {
    const average =
      asset.recentScores.reduce((sum, score) => sum + score, 0) /
      Math.max(1, asset.recentScores.length)
    const expected = kind === 'driver' ? asset.price * 0.95 : asset.price * 1.08
    const delta = Math.max(
      -PRICE_MAX_CHANGE,
      Math.min(PRICE_MAX_CHANGE, (average - expected) / 12),
    )

    return {
      ...asset,
      price: clampPrice(asset.price + delta),
    }
  })

const scoreManager = (
  manager: ManagerTeam,
  roundData: RoundData,
  driversMap: Map<string, DriverAsset>,
  constructorsMap: Map<string, ConstructorAsset>,
  isSeasonOpener = false,
): ManagerRoundResult => {
  const driverScoreMap = buildDriverScoreMap(roundData)
  const constructorScoreMap = buildConstructorScoreMap(roundData)
  const transferSummary = createTransferSummary(
    manager,
    driversMap,
    constructorsMap,
    isSeasonOpener,
  )

  const driverScores = manager.drivers.map((driver) => {
    const score = driverScoreMap.get(driver)
    return score ?? {
      driver,
      qualifyingPoints: 0,
      sprintPoints: 0,
      racePoints: 0,
      totalRaw: 0,
      drsMultiplier: 1,
      totalFinal: 0,
    }
  })

  const highestDriver = [...driverScores].sort((left, right) => right.totalRaw - left.totalRaw)[0]
  const secondHighestDriver = [...driverScores]
    .sort((left, right) => right.totalRaw - left.totalRaw)[1]
  let drsDriver = manager.drivers.includes(manager.drsBoostDriver)
    ? manager.drsBoostDriver
    : highestDriver?.driver
  let tripleDrsDriver = manager.drivers.includes(manager.extraDrsDriver)
    ? manager.extraDrsDriver
    : secondHighestDriver?.driver ?? highestDriver?.driver

  if (manager.activeChip === 'autopilot' && highestDriver) {
    drsDriver = highestDriver.driver
  }

  if (manager.activeChip === 'extraDrs') {
    const resolvedTargets = resolveExtraDrsTargets(
      manager.drivers,
      drsDriver,
      tripleDrsDriver,
    )
    drsDriver = resolvedTargets.drsBoostDriver
    tripleDrsDriver = resolvedTargets.extraDrsDriver
  }

  const finalizedDriverScores = driverScores.map((score) => {
    let multiplier = 1
    if (manager.activeChip === 'extraDrs') {
      if (score.driver === tripleDrsDriver) {
        multiplier = 3
      } else if (score.driver === drsDriver) {
        multiplier = 2
      }
    } else if (score.driver === drsDriver) {
      multiplier = 2
    }
    const totalFinal = score.totalRaw * multiplier
    return {
      ...score,
      drsMultiplier: multiplier,
      totalFinal,
    }
  })

  let constructorScores = manager.constructors.map((constructorName) => {
    const score = constructorScoreMap.get(constructorName)
    return score ?? {
      constructor: constructorName,
      qualifyingPoints: 0,
      sprintPoints: 0,
      racePoints: 0,
      pitStopPoints: 0,
      total: 0,
    }
  })

  let adjustedDriverScores = finalizedDriverScores

  if (manager.activeChip === 'noNegative') {
    adjustedDriverScores = finalizedDriverScores.map((score) => ({
      ...score,
      totalFinal: Math.max(0, score.totalFinal),
    }))
    constructorScores = constructorScores.map((score) => ({
      ...score,
      total: Math.max(0, score.total),
    }))
  }

  const grossPoints =
    adjustedDriverScores.reduce((sum, score) => sum + score.totalFinal, 0) +
    constructorScores.reduce((sum, score) => sum + score.total, 0)

  const netPoints = grossPoints + transferSummary.penalty

  return {
    managerId: manager.id,
    driverScores: adjustedDriverScores,
    constructorScores,
    chipApplied: manager.activeChip,
    transferPenalty: transferSummary.penalty,
    grossPoints,
    netPoints,
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(() => createEmptyState())

  const selectSeason = useCallback((season: number) => {
    const selectedEntry = seasonCatalog.find((entry) => entry.season === season)
    if (!selectedEntry) {
      return
    }

    setState(initializeStateForSeason(selectedEntry))
  }, [])

  const exitToSeasonSelect = useCallback(() => {
    setState(createEmptyState())
  }, [])

  const restartSeason = useCallback(() => {
    if (!state.selectedSeason) {
      setState(createEmptyState())
      return
    }

    const selectedEntry = seasonCatalog.find((entry) => entry.season === state.selectedSeason)
    if (!selectedEntry) {
      return
    }

    setState(initializeStateForSeason(selectedEntry))
  }, [state.selectedSeason])

  const resetSeason = useCallback(() => {
    if (!state.selectedSeason) {
      setState(createEmptyState())
      return
    }

    const selectedEntry = seasonCatalog.find((entry) => entry.season === state.selectedSeason)
    if (!selectedEntry) {
      return
    }

    setState(initializeStateForSeason(selectedEntry))
  }, [state.selectedSeason])

  const setCurrentView = useCallback((view: GameView) => {
    setState((previous) => ({ ...previous, currentView: view }))
  }, [])

  const replaceDriver = useCallback((slotIndex: number, driver: string) => {
    setState((previous) => {
      const manager = previous.managers.find((entry) => entry.isHuman)
      if (!manager || manager.drivers.includes(driver)) {
        return previous
      }

      const activeDrivers = getRoundActiveDrivers(
        previous.seasonData?.rounds[previous.currentRound] ?? null,
      )
      if (activeDrivers.size > 0 && !activeDrivers.has(driver)) {
        return previous
      }

      const driversMap = getDriversMap(previous.drivers)
      const constructorsMap = getConstructorsMap(previous.constructors)

      const nextManagers = previous.managers.map((entry) => {
        if (entry.id !== manager.id) {
          return entry
        }

        const nextDrivers = [...entry.drivers]
        nextDrivers[slotIndex] = driver
        const { drsBoostDriver, extraDrsDriver } = resolveExtraDrsTargets(
          nextDrivers,
          entry.drsBoostDriver,
          entry.extraDrsDriver,
        )

        return syncBudget(
          {
            ...entry,
            drivers: nextDrivers,
            drsBoostDriver,
            extraDrsDriver,
          },
          driversMap,
          constructorsMap,
        )
      })

      return {
        ...previous,
        managers: nextManagers,
      }
    })
  }, [])

  const replaceConstructor = useCallback((slotIndex: number, constructorName: string) => {
    setState((previous) => {
      const manager = previous.managers.find((entry) => entry.isHuman)
      if (!manager || manager.constructors.includes(constructorName)) {
        return previous
      }

      const driversMap = getDriversMap(previous.drivers)
      const constructorsMap = getConstructorsMap(previous.constructors)

      const nextManagers = previous.managers.map((entry) => {
        if (entry.id !== manager.id) {
          return entry
        }

        const nextConstructors = [...entry.constructors]
        nextConstructors[slotIndex] = constructorName

        return syncBudget(
          {
            ...entry,
            constructors: nextConstructors,
          },
          driversMap,
          constructorsMap,
        )
      })

      return {
        ...previous,
        managers: nextManagers,
      }
    })
  }, [])

  const setDrsBoostDriver = useCallback((driver: string) => {
    setState((previous) => ({
      ...previous,
      managers: previous.managers.map((manager) =>
        manager.isHuman && manager.drivers.includes(driver)
          ? {
              ...manager,
              ...resolveExtraDrsTargets(manager.drivers, driver, manager.extraDrsDriver),
            }
          : manager,
      ),
    }))
  }, [])

  const setExtraDrsTargets = useCallback((tripleDriver: string, doubleDriver: string) => {
    setState((previous) => ({
      ...previous,
      managers: previous.managers.map((manager) =>
        manager.isHuman
          ? {
              ...manager,
              ...resolveExtraDrsTargets(manager.drivers, doubleDriver, tripleDriver),
            }
          : manager,
      ),
    }))
  }, [])

  const setActiveChip = useCallback((chip: ChipType | null) => {
    setState((previous) => {
      const driversMap = getDriversMap(previous.drivers)
      const constructorsMap = getConstructorsMap(previous.constructors)

      return {
        ...previous,
        managers: previous.managers.map((manager) => {
          if (!manager.isHuman) {
            return manager
          }

          const toggledChip = manager.activeChip === chip ? null : chip

          if (manager.activeChip === 'limitless' && toggledChip !== 'limitless' && manager.backupDrivers && manager.backupConstructors) {
            const restoredTargets = resolveExtraDrsTargets(
              manager.backupDrivers,
              manager.drsBoostDriver,
              manager.extraDrsDriver,
            )
            return syncBudget(
              {
                ...manager,
                activeChip: toggledChip,
                drivers: manager.backupDrivers,
                constructors: manager.backupConstructors,
                drsBoostDriver: restoredTargets.drsBoostDriver,
                extraDrsDriver: restoredTargets.extraDrsDriver,
                backupDrivers: undefined,
                backupConstructors: undefined,
                backupBudget: undefined,
              },
              driversMap,
              constructorsMap,
            )
          }

          if (toggledChip === 'limitless' && !manager.backupDrivers && !manager.backupConstructors) {
            return {
              ...manager,
              activeChip: toggledChip,
              backupDrivers: [...manager.drivers],
              backupConstructors: [...manager.constructors],
              backupBudget: manager.budget,
            }
          }

          if (toggledChip === 'extraDrs') {
            return {
              ...manager,
              activeChip: toggledChip,
              ...resolveExtraDrsTargets(
                manager.drivers,
                manager.drsBoostDriver,
                manager.extraDrsDriver,
              ),
            }
          }

          return {
            ...manager,
            activeChip: toggledChip,
          }
        }),
      }
    })
  }, [])

  const processCurrentRound = useCallback(() => {
    setState((previous) => {
      if (!previous.seasonData) {
        return previous
      }

      if (previous.isSeasonComplete) {
        return {
          ...previous,
          currentView: 'seasonSummary',
        }
      }

      const seasonData = previous.seasonData
      const roundData = seasonData.rounds[previous.currentRound]
      if (!roundData) {
        return previous
      }

      const driversMap = getDriversMap(previous.drivers)
      const constructorsMap = getConstructorsMap(previous.constructors)
      const isSeasonOpener = previous.lastProcessedRound === -1 && previous.currentRound === 0
      const preparedManagers = previous.managers.map((manager) =>
        manager.isHuman
          ? syncBudget(manager, driversMap, constructorsMap)
          : applyAiStrategy(
              manager,
              seasonData,
              roundData,
              previous.drivers,
              previous.constructors,
              previous.lastProcessedRound,
            ),
      )

      const humanManager = preparedManagers.find((manager) => manager.isHuman)
      if (!humanManager) {
        return previous
      }

      const humanSummary = createTransferSummary(
        humanManager,
        driversMap,
        constructorsMap,
        isSeasonOpener,
      )
      if (!humanSummary.canProcess) {
        return {
          ...previous,
          managers: preparedManagers,
        }
      }

      const roundResults = preparedManagers.map((manager) =>
        scoreManager(manager, roundData, driversMap, constructorsMap, isSeasonOpener),
      )

      const driverRoundScores = buildDriverScoreMap(roundData)
      const constructorRoundScores = buildConstructorScoreMap(roundData)

      const nextDrivers = adjustPrices(
        previous.drivers.map((driver) => {
          const roundScore = driverRoundScores.get(driver.abbreviation)?.totalRaw ?? 0
          return {
            ...driver,
            fantasyPoints: driver.fantasyPoints + roundScore,
            recentScores: [...driver.recentScores, roundScore].slice(-3),
          }
        }),
        'driver',
      )

      const nextConstructors = adjustPrices(
        previous.constructors.map((constructor) => {
          const roundScore = constructorRoundScores.get(constructor.name)?.total ?? 0
          return {
            ...constructor,
            fantasyPoints: constructor.fantasyPoints + roundScore,
            recentScores: [...constructor.recentScores, roundScore].slice(-3),
          }
        }),
        'constructor',
      )

      const nextDriversMap = getDriversMap(nextDrivers)
      const nextConstructorsMap = getConstructorsMap(nextConstructors)

      const updatedManagers = preparedManagers.map((manager) => {
        const result = roundResults.find((entry) => entry.managerId === manager.id)
        const summary = createTransferSummary(
          manager,
          driversMap,
          constructorsMap,
          isSeasonOpener,
        )
        const countedTransfers =
          isSeasonOpener
            ? 0
            : manager.activeChip === 'wildcard' || manager.activeChip === 'limitless'
            ? 0
            : summary.transfersUsed
        const nextFreeTransfers = isSeasonOpener
          ? FREE_TRANSFERS_PER_ROUND
          : Math.min(
              MAX_FREE_TRANSFERS,
              FREE_TRANSFERS_PER_ROUND + Math.max(0, manager.freeTransfers - countedTransfers),
            )

        const usedChip = manager.activeChip
        const nextChipState = usedChip
          ? {
              ...manager.chips,
              [usedChip]: false,
            }
          : manager.chips

        const restoredDrivers =
          usedChip === 'limitless' && manager.backupDrivers ? manager.backupDrivers : manager.drivers
        const restoredConstructors =
          usedChip === 'limitless' && manager.backupConstructors
            ? manager.backupConstructors
            : manager.constructors
        const restoredTargets = resolveExtraDrsTargets(
          restoredDrivers,
          manager.drsBoostDriver,
          manager.extraDrsDriver,
        )

        return syncBudget(
          {
            ...manager,
            drivers: restoredDrivers,
            constructors: restoredConstructors,
            drsBoostDriver: restoredTargets.drsBoostDriver,
            extraDrsDriver: restoredTargets.extraDrsDriver,
            chips: nextChipState,
            activeChip: null,
            backupDrivers: undefined,
            backupConstructors: undefined,
            backupBudget: undefined,
            totalPoints: manager.totalPoints + (result?.netPoints ?? 0),
            weeklyPoints: [...manager.weeklyPoints, result?.netPoints ?? 0],
            freeTransfers: nextFreeTransfers,
            lockedDrivers: [...restoredDrivers],
            lockedConstructors: [...restoredConstructors],
          },
          nextDriversMap,
          nextConstructorsMap,
        )
      })

      const nextRound = previous.currentRound + 1
      const isSeasonComplete = nextRound >= seasonData.rounds.length

      return {
        ...previous,
        drivers: nextDrivers,
        constructors: nextConstructors,
        managers: updatedManagers,
        currentRound: nextRound,
        isSeasonComplete,
        lastProcessedRound: previous.currentRound,
        roundResults: [...previous.roundResults, roundResults],
        currentView: isSeasonComplete ? previous.currentView : previous.currentView,
      }
    })
  }, [])

  const selectedSeasonEntry = useMemo(
    () =>
      seasonCatalog.find((entry) => entry.season === state.selectedSeason) ?? null,
    [state.selectedSeason],
  )

  const currentRoundData = useMemo(
    () => state.seasonData?.rounds[state.currentRound] ?? null,
    [state.currentRound, state.seasonData],
  )

  const humanManager = useMemo(
    () => state.managers.find((manager) => manager.isHuman) ?? null,
    [state.managers],
  )

  const standings = useMemo(
    () => [...state.managers].sort((left, right) => right.totalPoints - left.totalPoints),
    [state.managers],
  )

  const getTransferSummary = useCallback(
    (managerId: string) => {
      const manager = state.managers.find((entry) => entry.id === managerId)
      if (!manager) {
        return {
          transfersUsed: 0,
          penalty: 0,
          lineupCost: 0,
          remainingBudget: 0,
          overBudgetBy: 0,
          canIgnoreBudget: false,
          canProcess: false,
          isSeasonOpener: false,
        }
      }

      return createTransferSummary(
        manager,
        getDriversMap(state.drivers),
        getConstructorsMap(state.constructors),
        state.lastProcessedRound === -1 && state.currentRound === 0,
      )
    },
    [state.constructors, state.currentRound, state.drivers, state.lastProcessedRound, state.managers],
  )

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      seasonCatalog,
      selectedSeasonEntry,
      currentRoundData,
      humanManager,
      standings,
      selectSeason,
      exitToSeasonSelect,
      restartSeason,
      resetSeason,
      setCurrentView,
      replaceDriver,
      replaceConstructor,
      setDrsBoostDriver,
      setExtraDrsTargets,
      setActiveChip,
      processCurrentRound,
      getTransferSummary,
    }),
    [
      currentRoundData,
      exitToSeasonSelect,
      getTransferSummary,
      humanManager,
      processCurrentRound,
      replaceConstructor,
      replaceDriver,
      restartSeason,
      resetSeason,
      selectSeason,
      selectedSeasonEntry,
      setActiveChip,
      setCurrentView,
      setDrsBoostDriver,
      setExtraDrsTargets,
      standings,
      state,
    ],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export { GameContext }
