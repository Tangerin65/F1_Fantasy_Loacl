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
  type ScoreBreakdownItem,
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
  hasSavedGame: boolean
  selectSeason: (season: number) => void
  exitToSeasonSelect: () => void
  restartSeason: () => void
  resetSeason: () => void
  saveGame: () => void
  loadSavedGame: () => void
  setCurrentView: (view: GameView) => void
  replaceDriver: (slotIndex: number, driver: string) => void
  replaceConstructor: (slotIndex: number, constructorName: string) => void
  resetHumanLineup: () => void
  setDrsBoostDriver: (driver: string) => void
  setExtraDrsTargets: (tripleDriver: string, doubleDriver: string) => void
  setActiveChip: (chip: ChipType | null) => void
  processCurrentRound: () => void
  getTransferSummary: (managerId: string) => TransferSummary
}

const seasonCatalog = getSeasonCatalog()

const SAVE_KEY = 'f1_fantasy_save'
const SAVE_VERSION = 1

interface SaveFile {
  version: number
  savedAt: string
  state: GameState
}

const hasSavedGame = (): boolean => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const save: SaveFile = JSON.parse(raw)
    if (save.version !== SAVE_VERSION) return false
    if (!save.state?.selectedSeason || !save.state?.seasonData) return false
    return true
  } catch {
    return false
  }
}

const writeSaveFile = (state: GameState): void => {
  const save: SaveFile = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}

const readSaveFile = (): GameState | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const save: SaveFile = JSON.parse(raw)
    if (save.version !== SAVE_VERSION) return null
    return save.state ?? null
  } catch {
    return null
  }
}

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

type RosterPlan = {
  drivers: string[]
  constructors: string[]
  score: number
  cost: number
}

const isBetterRosterPlan = (candidate: RosterPlan, current: RosterPlan | null) =>
  !current ||
  candidate.score > current.score ||
  (candidate.score === current.score && candidate.cost > current.cost)

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
  const canIgnoreBudget = manager.activeChip === 'limitless'
  const freeAllowance =
    isSeasonOpener
      ? Number.POSITIVE_INFINITY
      : manager.activeChip === 'wildcard' || manager.activeChip === 'limitless'
      ? Number.POSITIVE_INFINITY
      : manager.freeTransfers
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
      manager.drivers.filter(Boolean).length === MAX_DRIVERS &&
      manager.constructors.filter(Boolean).length === MAX_CONSTRUCTORS,
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

const isRbFamily = (lower: string): boolean =>
  lower.includes('rb') ||
  lower.includes('racing bulls') ||
  lower.includes('alphatauri') ||
  lower.includes('alpha tauri') ||
  lower.includes('tororosso') ||
  lower.includes('toro rosso')

const rbFamilyName = (season: number): string => {
  if (season >= 2024) return 'RB F1 Team'
  if (season >= 2020) return 'AlphaTauri'
  return 'Toro Rosso'
}

const getQualifyingConstructorBonus = (
  results: RoundData['qualifying']['results'],
  constructorName: string,
  season?: number,
) => {
  const constructorResults = results.filter((entry) => {
    const lower = entry.team.toLowerCase()
    if (lower.includes('red bull')) return 'Red Bull Racing' === constructorName
    if (lower.includes('ferrari')) return 'Ferrari' === constructorName
    if (lower.includes('mclaren')) return 'McLaren' === constructorName
    if (lower.includes('mercedes')) return 'Mercedes' === constructorName
    if (lower.includes('williams')) return 'Williams' === constructorName
    if (lower.includes('haas')) return 'Haas F1 Team' === constructorName
    if (isRbFamily(lower)) return (season ? rbFamilyName(season) : 'RB F1 Team') === constructorName

    // Sauber / Alfa Romeo — "Alfa Romeo Sauber" in 2018-2021
    if (
      lower.includes('sauber') ||
      lower.includes('alfa romeo') ||
      lower.includes('alfa') ||
      lower.includes('kick') ||
      lower.includes('stake')
    ) {
      if (season && season >= 2018 && season <= 2021) return 'Alfa Romeo Sauber' === constructorName
      return 'Sauber' === constructorName
    }

    // Alpine → Renault (the team was called Renault until 2020)
    if (lower.includes('alpine')) {
      if (season && season <= 2020) return 'Renault' === constructorName
      return 'Alpine' === constructorName
    }

    // Aston Martin → Racing Point (2019-2020)
    if (lower.includes('aston martin')) {
      if (season && season >= 2019 && season <= 2020) return 'Racing Point' === constructorName
      return 'Aston Martin' === constructorName
    }

    // Racing Point → Force India in 2018
    if (lower.includes('racing point')) {
      if (season && season === 2018) return 'Force India' === constructorName
      return 'Racing Point' === constructorName
    }

    if (lower.includes('force india')) return 'Force India' === constructorName
    if (lower.includes('renault')) return 'Renault' === constructorName
    return entry.team === constructorName
  })
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

const scoreRaceDriver = (result: RaceResult, fastestLapDriver: string, driverOfTheDay: string | null) => {
  const positionPoints = getRacePositionPoints(result.position)
  const movementPoints = getPositionDeltaPoints(result.grid, result.position)
  const fastestLapPoints = result.driver === fastestLapDriver ? 10 : 0
  const dotdPoints = result.driver === driverOfTheDay ? 10 : 0
  const retirementPenalty = isDsqStatus(result.status)
    ? -20
    : !isFinishedStatus(result.status)
      ? -20
      : 0

  return {
    total: positionPoints + movementPoints + fastestLapPoints + dotdPoints + retirementPenalty,
    constructorApplicablePoints: positionPoints + movementPoints + retirementPenalty,
    fastestLapPoints,
    dotdPoints,
  }
}

const getQualifyingBreakdown = (
  result: RoundData['qualifying']['results'][number],
): ScoreBreakdownItem[] => {
  const items: ScoreBreakdownItem[] = []

  if (isDsqStatus(result.status)) {
    items.push({ label: 'Disqualified (DSQ)', labelZh: '取消排位赛资格 (DSQ)', points: -5 })
    return items
  }

  if (!result.q1 && !isFinishedStatus(result.status)) {
    items.push({ label: 'No time set in Q1', labelZh: 'Q1 未做出有效时间', points: -5 })
    return items
  }

  const posPoints = getQualifyingPositionPoints(result.position)
  if (posPoints !== 0) {
    items.push({ label: `Qualified P${result.position}`, labelZh: `排位赛 P${result.position} 完赛`, points: posPoints })
  } else {
    items.push({ label: `Qualified P${result.position} (outside top 10)`, labelZh: `排位赛 P${result.position}（前十名外）`, points: 0 })
  }

  return items
}

const getSprintBreakdown = (
  result: SprintResult,
  fastestLapDriver: string | undefined,
): ScoreBreakdownItem[] => {
  const items: ScoreBreakdownItem[] = []

  const posPoints = getSprintPositionPoints(result.position)
  items.push({ label: `Sprint finish P${result.position}`, labelZh: `冲刺赛 P${result.position} 完赛`, points: posPoints })

  const delta = result.grid - result.position
  if (delta > 0) {
    items.push({ label: `Positions gained: +${delta}`, labelZh: `提升名次: +${delta}`, points: delta })
  } else if (delta < 0) {
    const penalty = Math.max(delta, -10)
    items.push({ label: `Positions lost: ${delta}`, labelZh: `下降名次: ${delta}`, points: penalty })
  }

  if (result.driver === fastestLapDriver) {
    items.push({ label: 'Sprint fastest lap', labelZh: '冲刺赛最快圈速', points: 5 })
  }

  if (!isFinishedStatus(result.status)) {
    items.push({ label: 'Sprint DNF', labelZh: '冲刺赛 DNF', points: -10 })
  }

  return items
}

const getRaceBreakdown = (
  result: RaceResult,
  fastestLapDriver: string,
  driverOfTheDay: string | null,
): ScoreBreakdownItem[] => {
  const items: ScoreBreakdownItem[] = []

  const posPoints = getRacePositionPoints(result.position)
  if (posPoints > 0) {
    items.push({ label: `Race finish P${result.position}`, labelZh: `正赛 P${result.position} 完赛`, points: posPoints })
  } else {
    items.push({ label: `Race finish P${result.position} (outside top 10)`, labelZh: `正赛 P${result.position}（前十名外）`, points: 0 })
  }

  const delta = result.grid - result.position
  if (delta > 0) {
    items.push({ label: `Positions gained: +${delta}`, labelZh: `提升名次: +${delta}`, points: delta })
  } else if (delta < 0) {
    const penalty = Math.max(delta, -10)
    items.push({ label: `Positions lost: ${delta}`, labelZh: `下降名次: ${delta}`, points: penalty })
  }

  if (result.driver === fastestLapDriver) {
    items.push({ label: 'Race fastest lap', labelZh: '正赛最快圈速', points: 10 })
  }

  if (result.driver === driverOfTheDay) {
    items.push({ label: 'Driver of the Day', labelZh: '今日最佳车手', points: 10 })
  }

  if (isDsqStatus(result.status)) {
    items.push({ label: 'Disqualified (DSQ)', labelZh: '取消正赛资格 (DSQ)', points: -20 })
  } else if (!isFinishedStatus(result.status)) {
    items.push({ label: 'Race DNF', labelZh: '正赛 DNF', points: -20 })
  }

  return items
}

const buildDriverScoreMap = (roundData: RoundData) => {
  const driverOfTheDay = roundData.race.driverOfTheDay ?? null

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
    roundData.race.results.map((entry) => [entry.driver, scoreRaceDriver(entry, roundData.race.fastestLapDriver, driverOfTheDay)]),
  )

  // Build detailed breakdowns per driver from raw results.
  const qualifyingBreakdownMap = new Map(
    roundData.qualifying.results.map((entry) => [entry.driver, getQualifyingBreakdown(entry)]),
  )
  const sprintBreakdownMap = new Map(
    (roundData.sprint?.results ?? []).map((entry) => [
      entry.driver,
      getSprintBreakdown(entry, roundData.sprint?.fastestLapDriver),
    ]),
  )
  const raceBreakdownMap = new Map(
    roundData.race.results.map((entry) => [
      entry.driver,
      getRaceBreakdown(entry, roundData.race.fastestLapDriver, driverOfTheDay),
    ]),
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
      breakdown: {
        qualifying: qualifyingBreakdownMap.get(result.driver) ?? [],
        sprint: sprintBreakdownMap.get(result.driver) ?? [],
        race: raceBreakdownMap.get(result.driver) ?? [],
      },
    })
    return map
  }, new Map<string, DriverRoundScore>())
}

const buildConstructorScoreMap = (roundData: RoundData, season?: number) => {
  const constructorScores = new Map<string, ConstructorRoundScore>()

  // Track breakdown items alongside totals for each constructor.
  const qualifyingItems = new Map<string, ScoreBreakdownItem[]>()
  const sprintItems = new Map<string, ScoreBreakdownItem[]>()
  const raceItems = new Map<string, ScoreBreakdownItem[]>()
  const pitStopItems = new Map<string, ScoreBreakdownItem[]>()

  // Normalize constructor names to canonical form to match assets.
  const normalizeName = (raw: string): string => {
    const lower = raw.toLowerCase()
    if (lower.includes('red bull')) return 'Red Bull Racing'
    if (lower.includes('ferrari')) return 'Ferrari'
    if (lower.includes('mclaren')) return 'McLaren'
    if (lower.includes('mercedes')) return 'Mercedes'
    if (lower.includes('williams')) return 'Williams'
    if (lower.includes('haas')) return 'Haas F1 Team'
    if (isRbFamily(lower)) return season ? rbFamilyName(season) : 'RB F1 Team'

    // Sauber / Alfa Romeo — "Alfa Romeo Sauber" in 2018-2021
    if (
      lower.includes('sauber') ||
      lower.includes('alfa romeo') ||
      lower.includes('alfa') ||
      lower.includes('kick') ||
      lower.includes('stake')
    ) {
      if (season && season >= 2018 && season <= 2021) return 'Alfa Romeo Sauber'
      return 'Sauber'
    }

    // Alpine → Renault (the team was called Renault until 2020)
    if (lower.includes('alpine')) {
      if (season && season <= 2020) return 'Renault'
      return 'Alpine'
    }

    // Aston Martin → Racing Point (2019-2020, before the works team returned)
    if (lower.includes('aston martin')) {
      if (season && season >= 2019 && season <= 2020) return 'Racing Point'
      return 'Aston Martin'
    }

    // Racing Point → Force India in 2018
    if (lower.includes('racing point')) {
      if (season && season === 2018) return 'Force India'
      return 'Racing Point'
    }

    if (lower.includes('force india')) return 'Force India'
    if (lower.includes('renault')) return 'Renault'
    return raw
  }

  const ensureEntry = (constructorName: string) => {
    if (!constructorScores.has(constructorName)) {
      constructorScores.set(constructorName, {
        constructor: constructorName,
        qualifyingPoints: 0,
        sprintPoints: 0,
        racePoints: 0,
        pitStopPoints: 0,
        total: 0,
      })
    }
    if (!qualifyingItems.has(constructorName)) qualifyingItems.set(constructorName, [])
    if (!sprintItems.has(constructorName)) sprintItems.set(constructorName, [])
    if (!raceItems.has(constructorName)) raceItems.set(constructorName, [])
    if (!pitStopItems.has(constructorName)) pitStopItems.set(constructorName, [])
  }

  for (const qualifyingResult of roundData.qualifying.results) {
    const qualTeam = normalizeName(qualifyingResult.team)
    ensureEntry(qualTeam)
    const score = constructorScores.get(qualTeam)!
    const posPoints = getQualifyingPositionPoints(qualifyingResult.position)
    score.qualifyingPoints += posPoints
    qualifyingItems.get(qualTeam)!.push({
      label: `${qualifyingResult.driver} — Qualified P${qualifyingResult.position}`,
      labelZh: `${qualifyingResult.driver} — 排位赛 P${qualifyingResult.position}`,
      points: posPoints,
    })
  }

  for (const [constructorName, score] of constructorScores) {
    const bonus = getQualifyingConstructorBonus(roundData.qualifying.results, constructorName, season)
    score.qualifyingPoints += bonus
    if (bonus === 10) {
      qualifyingItems.get(constructorName)!.push({ label: 'Both drivers reached Q3', labelZh: '两位车手进入 Q3', points: 10 })
    } else if (bonus === 5) {
      qualifyingItems.get(constructorName)!.push({ label: 'One driver reached Q3', labelZh: '一位车手进入 Q3', points: 5 })
    } else if (bonus === 3) {
      qualifyingItems.get(constructorName)!.push({ label: 'Both drivers reached Q2', labelZh: '两位车手进入 Q2', points: 3 })
    } else if (bonus === 1) {
      qualifyingItems.get(constructorName)!.push({ label: 'One driver reached Q2', labelZh: '一位车手进入 Q2', points: 1 })
    } else if (bonus === -1) {
      qualifyingItems.get(constructorName)!.push({ label: 'Both drivers eliminated in Q1', labelZh: '两位车手在 Q1 被淘汰', points: -1 })
    }
  }

  if (roundData.sprint) {
    for (const sprintResult of roundData.sprint.results) {
      const sprintTeam = normalizeName(sprintResult.team)
      ensureEntry(sprintTeam)
      const score = constructorScores.get(sprintTeam)!
      const sprintPointsForDriver = scoreSprintDriver(sprintResult, roundData.sprint.fastestLapDriver)
      score.sprintPoints += sprintPointsForDriver
      sprintItems.get(sprintTeam)!.push({
        label: `${sprintResult.driver} — Sprint P${sprintResult.position}`,
        labelZh: `${sprintResult.driver} — 冲刺赛 P${sprintResult.position}`,
        points: sprintPointsForDriver,
      })
    }
  }

  const pitStopRanking = new Map(
    roundData.race.pitStops.slice(0, 3).map((entry, index) => [
      normalizeName(entry.constructor),
      { points: [15, 10, 5][index] ?? 0, rank: index + 1 },
    ]),
  )

  for (const raceResult of roundData.race.results) {
    const raceTeam = normalizeName(raceResult.team)
    ensureEntry(raceTeam)
    const score = constructorScores.get(raceTeam)!
    const raceDriverScore = scoreRaceDriver(raceResult, roundData.race.fastestLapDriver, roundData.race.driverOfTheDay ?? null)
    score.racePoints += raceDriverScore.constructorApplicablePoints

    const delta = raceResult.grid - raceResult.position
    let raceLabel = `${raceResult.driver} — Race P${raceResult.position}`
    let raceLabelZh = `${raceResult.driver} — 正赛 P${raceResult.position}`
    if (delta > 0) {
      raceLabel += ` (+${delta})`
      raceLabelZh += ` (+${delta})`
    }
    else if (delta < 0) {
      raceLabel += ` (${delta})`
      raceLabelZh += ` (${delta})`
    }
    raceItems.get(raceTeam)!.push({
      label: raceLabel,
      labelZh: raceLabelZh,
      points: raceDriverScore.constructorApplicablePoints,
    })

    const pitInfo = pitStopRanking.get(raceTeam)
    if (pitInfo && !pitStopItems.get(raceTeam)!.length) {
      score.pitStopPoints = pitInfo.points
      const pitTime = roundData.race.pitStops.find((p) => normalizeName(p.constructor) === raceTeam)?.fastestStop.toFixed(3) ?? '--'
      pitStopItems.get(raceTeam)!.push({
        label: `Pit stop ranked #${pitInfo.rank} overall (${pitTime}s)`,
        labelZh: `进站排名第 #${pitInfo.rank}（${pitTime}s）`,
        points: pitInfo.points,
      })
    }
  }

  for (const score of constructorScores.values()) {
    score.total =
      score.qualifyingPoints + score.sprintPoints + score.racePoints + score.pitStopPoints
  }

  // Attach breakdowns.
  for (const [constructorName, score] of constructorScores) {
    score.breakdown = {
      qualifying: qualifyingItems.get(constructorName) ?? [],
      sprint: sprintItems.get(constructorName) ?? [],
      race: raceItems.get(constructorName) ?? [],
      pitStop: pitStopItems.get(constructorName) ?? [],
    }
  }

  return constructorScores
}

const buildOpeningRoster = (
  drivers: DriverAsset[],
  constructors: ConstructorAsset[],
  performance: PerformanceSnapshot,
  style: AIStyle | 'balanced',
  activeDrivers?: Set<string>,
) => {
  const driverCandidates =
    activeDrivers && activeDrivers.size >= MAX_DRIVERS
      ? drivers.filter((driver) => activeDrivers.has(driver.abbreviation))
      : [...drivers]
  const constructorCandidates = [...constructors]

  const driverScore = (driver: DriverAsset) => {
    const average = performance.driverAverages.get(driver.abbreviation) ?? 0
    const ppm = performance.driverPointsPerMillion.get(driver.abbreviation) ?? 0
    const gains = performance.driverGainAverage.get(driver.abbreviation) ?? 0

    // Stability bonus: reward consistent scoring (lower variance = higher bonus).
    const scores = driver.recentScores
    const scoreRange = scores.length >= 2
      ? Math.max(...scores) - Math.min(...scores)
      : average * 0.5
    const stability = Math.max(0, 1 - scoreRange / Math.max(average, 1))
    const stabilityBonus = stability * 4

    if (style === 'fanatic') {
      return average * 1.4 + driver.price * 0.7 + (FANATIC_TEAMS.has(driver.team) ? 14 : 0) + stabilityBonus
    }

    if (style === 'value') {
      return ppm * 24 + average * 1.7 - driver.price * 0.18 + stabilityBonus
    }

    if (style === 'underdog') {
      return average * 1.0 + gains * 5 + Math.max(0, 15 - driver.price) * 0.8 + stabilityBonus * 0.8
    }

    // balanced (used by opening roster)
    return average * 1.5 + ppm * 12 - driver.price * 0.12 + stabilityBonus
  }

  const constructorScore = (constructor: ConstructorAsset) => {
    const average = performance.constructorAverages.get(constructor.name) ?? 0

    // Stability bonus for constructors too.
    const scores = constructor.recentScores
    const scoreRange = scores.length >= 2
      ? Math.max(...scores) - Math.min(...scores)
      : average * 0.5
    const stability = Math.max(0, 1 - scoreRange / Math.max(average, 1))
    const stabilityBonus = stability * 4

    if (style === 'fanatic') {
      return average * 1.35 + constructor.price * 0.65 + (FANATIC_TEAMS.has(constructor.name) ? 12 : 0) + stabilityBonus
    }

    if (style === 'value') {
      return average * 1.5 - constructor.price * 0.18 + stabilityBonus
    }

    if (style === 'underdog') {
      return average * 1.1 + Math.max(0, 16 - constructor.price) * 1.0 + stabilityBonus * 0.8
    }

    return average * 1.3 - constructor.price * 0.12 + stabilityBonus
  }

  const pickBestDriverPlan = (budget: number): RosterPlan | null => {
    let bestPlan: RosterPlan | null = null
    const selectedDrivers: DriverAsset[] = []

    const search = (
      startIndex: number,
      selectedCount: number,
      currentCost: number,
      currentScore: number,
    ) => {
      if (currentCost > budget) {
        return
      }

      if (selectedCount === MAX_DRIVERS) {
        const candidatePlan: RosterPlan = {
          drivers: selectedDrivers.map((driver) => driver.abbreviation),
          constructors: [],
          score: currentScore,
          cost: roundToTenth(currentCost),
        }

        if (isBetterRosterPlan(candidatePlan, bestPlan)) {
          bestPlan = candidatePlan
        }
        return
      }

      const remainingSlots = MAX_DRIVERS - selectedCount
      for (let index = startIndex; index <= driverCandidates.length - remainingSlots; index += 1) {
        const driver = driverCandidates[index]
        selectedDrivers.push(driver)
        search(
          index + 1,
          selectedCount + 1,
          roundToTenth(currentCost + driver.price),
          currentScore + driverScore(driver),
        )
        selectedDrivers.pop()
      }
    }

    search(0, 0, 0, 0)
    return bestPlan
  }

  let bestPlan: RosterPlan | null = null

  for (let leftIndex = 0; leftIndex < constructorCandidates.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < constructorCandidates.length; rightIndex += 1) {
      const selectedConstructors = [
        constructorCandidates[leftIndex],
        constructorCandidates[rightIndex],
      ]
      const constructorCost = roundToTenth(
        selectedConstructors[0].price + selectedConstructors[1].price,
      )
      if (constructorCost > INITIAL_BUDGET) {
        continue
      }

      const driverPlan = pickBestDriverPlan(roundToTenth(INITIAL_BUDGET - constructorCost))
      if (!driverPlan) {
        continue
      }

      const candidatePlan: RosterPlan = {
        drivers: driverPlan.drivers,
        constructors: selectedConstructors.map((constructor) => constructor.name),
        score:
          driverPlan.score +
          selectedConstructors.reduce((sum, constructor) => sum + constructorScore(constructor), 0),
        cost: roundToTenth(driverPlan.cost + constructorCost),
      }

      if (isBetterRosterPlan(candidatePlan, bestPlan)) {
        bestPlan = candidatePlan
      }
    }
  }

  if (bestPlan) {
    return {
      drivers: bestPlan.drivers,
      constructors: bestPlan.constructors,
      score: bestPlan.score,
    }
  }

  const fallbackDrivers = [...driverCandidates]
    .sort((left, right) => driverScore(right) - driverScore(left) || left.price - right.price)
    .slice(0, MAX_DRIVERS)
    .map((driver) => driver.abbreviation)
  const fallbackConstructors = [...constructorCandidates]
    .sort((left, right) => constructorScore(right) - constructorScore(left) || left.price - right.price)
    .slice(0, MAX_CONSTRUCTORS)
    .map((constructor) => constructor.name)

  return {
    drivers: fallbackDrivers,
    constructors: fallbackConstructors,
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
  const openerActiveDrivers = getRoundActiveDrivers(seasonData.rounds[0] ?? null)
  const fanaticRoster = buildOpeningRoster(
    drivers,
    constructors,
    performance,
    'fanatic',
    openerActiveDrivers,
  )
  const valueRoster = buildOpeningRoster(
    drivers,
    constructors,
    performance,
    'value',
    openerActiveDrivers,
  )
  const underdogRoster = buildOpeningRoster(
    drivers,
    constructors,
    performance,
    'underdog',
    openerActiveDrivers,
  )

  const driverMap = getDriversMap(drivers)
  const constructorMap = getConstructorsMap(constructors)

  const baseManagers: ManagerTeam[] = [
    {
      id: 'human',
      name: 'You',
      isHuman: true,
      drivers: [],
      constructors: [],
      drsBoostDriver: '',
      extraDrsDriver: '',
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
  const roster = buildOpeningRoster(
    drivers,
    constructors,
    performance,
    manager.aiStyle,
    getRoundActiveDrivers(roundData),
  )
  const driverMap = getDriversMap(drivers)
  const constructorMap = getConstructorsMap(constructors)

  // Conservative transfer: only swap if the candidate is significantly better.
  // Compute a "keep score" for each current driver vs the candidate.
  const currentDrivers = manager.drivers.filter(Boolean)
  const computeDriverScore = (abbreviation: string) => {
    const driver = driverMap.get(abbreviation)
    if (!driver) return 0
    const avg = performance.driverAverages.get(abbreviation) ?? 0
    const ppm = performance.driverPointsPerMillion.get(abbreviation) ?? 0
    return avg * 1.5 + ppm * 10
  }

  // Start with the AI's optimal picks, then replace with current drivers
  // when the gain doesn't justify the transfer cost.
  const optimalDrivers = [...roster.drivers]
  const optimalSet = new Set(optimalDrivers)

  // Keep current drivers that are already in the optimal set.
  // For drivers not in the optimal set, only swap them out if the replacement
  // scores significantly higher (threshold based on AI style).
  const replacementThreshold = manager.aiStyle === 'fanatic' ? 5 : manager.aiStyle === 'value' ? 3 : 4

  const mergedDrivers: string[] = []
  const optimalRemaining = [...optimalDrivers]

  // First pass: keep current drivers that are still in the optimal set.
  for (const currentDriver of currentDrivers) {
    if (optimalSet.has(currentDriver)) {
      mergedDrivers.push(currentDriver)
      const idx = optimalRemaining.indexOf(currentDriver)
      if (idx >= 0) optimalRemaining.splice(idx, 1)
    }
  }

  // Second pass: for current drivers not in optimal, check if they're "close enough" to keep.
  for (const currentDriver of currentDrivers) {
    if (mergedDrivers.includes(currentDriver)) continue
    if (mergedDrivers.length >= MAX_DRIVERS) break

    const currentScore = computeDriverScore(currentDriver)
    const bestReplacement = optimalRemaining[0]
    const replacementScore = bestReplacement ? computeDriverScore(bestReplacement) : 0

    // Keep the current driver if the replacement isn't much better.
    if (bestReplacement && replacementScore - currentScore < replacementThreshold) {
      mergedDrivers.push(currentDriver)
    } else if (bestReplacement) {
      mergedDrivers.push(bestReplacement)
      optimalRemaining.shift()
    } else {
      mergedDrivers.push(currentDriver)
    }
  }

  // Fill remaining slots from optimal if needed.
  for (const driver of optimalRemaining) {
    if (mergedDrivers.length >= MAX_DRIVERS) break
    if (!mergedDrivers.includes(driver)) {
      mergedDrivers.push(driver)
    }
  }

  // Ensure we have exactly MAX_DRIVERS.
  const finalDrivers = mergedDrivers.slice(0, MAX_DRIVERS)
  while (finalDrivers.length < MAX_DRIVERS && optimalDrivers.length > finalDrivers.length) {
    const next = optimalDrivers.find((d) => !finalDrivers.includes(d))
    if (next) finalDrivers.push(next)
    else break
  }

  // DRS target: pick the most consistent high-scorer (not just the priciest).
  const driverScores = finalDrivers.map((abbr) => ({
    abbr,
    score: computeDriverScore(abbr),
    avg: performance.driverAverages.get(abbr) ?? 0,
  }))
  driverScores.sort((a, b) => b.score - a.score)
  const topDriver = driverScores[0]?.abbr ?? finalDrivers[0]
  const secondaryDriver = driverScores[1]?.abbr ?? finalDrivers[1] ?? topDriver

  let activeChip: ChipType | null = null
  const transferCount =
    computePendingTransfers(finalDrivers, manager.lockedDrivers) +
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
      finalDrivers.some((driver) => (performance.driverGainAverage.get(driver) ?? 0) > 2))
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
      drivers: finalDrivers,
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

const getPriceExpectation = (price: number, kind: 'driver' | 'constructor') =>
  price * (kind === 'driver' ? 1.0 : 1.45)

const getPriceLimitDamping = (price: number, delta: number) => {
  const priceRange = PRICE_CEILING - PRICE_FLOOR
  if (priceRange <= 0 || delta === 0) {
    return 1
  }

  const distance = delta > 0 ? PRICE_CEILING - price : price - PRICE_FLOOR
  return Math.max(0.2, Math.min(1, distance / priceRange))
}

const getLowPriceProtection = (price: number, delta: number, average: number) => {
  if (delta >= 0) {
    return delta
  }

  if (price < 4) {
    return average < 0 ? delta * 0.35 : 0
  }

  if (price < 5 && average >= 0) {
    return 0
  }

  if (price < 6) {
    return delta * 0.5
  }

  return delta
}

const adjustPrices = <TAsset extends DriverAsset | ConstructorAsset>(
  assets: TAsset[],
  kind: 'driver' | 'constructor',
) =>
  assets.map((asset) => {
    const average =
      asset.recentScores.reduce((sum, score) => sum + score, 0) /
      Math.max(1, asset.recentScores.length)
    const expected = getPriceExpectation(asset.price, kind)
    const rawDelta = (average - expected) / 12
    const dampedDelta = rawDelta * getPriceLimitDamping(asset.price, rawDelta)
    const protectedDelta = getLowPriceProtection(asset.price, dampedDelta, average)
    const delta = Math.max(
      -PRICE_MAX_CHANGE,
      Math.min(PRICE_MAX_CHANGE, protectedDelta),
    )
    const newPrice = clampPrice(asset.price + delta)

    return {
      ...asset,
      price: newPrice,
      lastPriceChange: roundToTenth(newPrice - asset.price),
    }
  })

const scoreManager = (
  manager: ManagerTeam,
  roundData: RoundData,
  driversMap: Map<string, DriverAsset>,
  constructorsMap: Map<string, ConstructorAsset>,
  isSeasonOpener = false,
  season?: number,
): ManagerRoundResult => {
  const driverScoreMap = buildDriverScoreMap(roundData)
  const constructorScoreMap = buildConstructorScoreMap(roundData, season)
  const transferSummary = createTransferSummary(
    manager,
    driversMap,
    constructorsMap,
    isSeasonOpener,
  )

  const lineupDrivers = manager.drivers.filter(Boolean)
  const lineupConstructors = manager.constructors.filter(Boolean)
  const driverScores = lineupDrivers.map((driver) => {
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
  let drsDriver = lineupDrivers.includes(manager.drsBoostDriver)
    ? manager.drsBoostDriver
    : highestDriver?.driver
  let tripleDrsDriver = lineupDrivers.includes(manager.extraDrsDriver)
    ? manager.extraDrsDriver
    : secondHighestDriver?.driver ?? highestDriver?.driver

  if (manager.activeChip === 'autopilot' && highestDriver) {
    drsDriver = highestDriver.driver
  }

  if (manager.activeChip === 'extraDrs') {
    const resolvedTargets = resolveExtraDrsTargets(
      lineupDrivers,
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

  let constructorScores = lineupConstructors.map((constructorName) => {
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

  const saveGame = useCallback(() => {
    setState((previous) => {
      if (!previous.selectedSeason || !previous.seasonData) return previous
      writeSaveFile(previous)
      return previous
    })
  }, [])

  const loadSavedGame = useCallback(() => {
    const saved = readSaveFile()
    if (saved && saved.selectedSeason && saved.seasonData) {
      setState(saved)
    }
  }, [])

  const setCurrentView = useCallback((view: GameView) => {
    setState((previous) => ({ ...previous, currentView: view }))
  }, [])

  const replaceDriver = useCallback((slotIndex: number, driver: string) => {
    setState((previous) => {
      const manager = previous.managers.find((entry) => entry.isHuman)
      if (!manager || slotIndex < 0 || slotIndex >= MAX_DRIVERS) {
        return previous
      }

      const currentSlotDriver = manager.drivers[slotIndex]
      if (manager.drivers.includes(driver) && currentSlotDriver !== driver) {
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

        const nextDrivers = Array.from({ length: MAX_DRIVERS }, (_, index) => entry.drivers[index] ?? '')
        nextDrivers[slotIndex] = driver
        const completedDrivers = nextDrivers.filter(Boolean)
        const { drsBoostDriver, extraDrsDriver } = resolveExtraDrsTargets(
          completedDrivers,
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
      if (!manager || slotIndex < 0 || slotIndex >= MAX_CONSTRUCTORS) {
        return previous
      }

      const currentSlotConstructor = manager.constructors[slotIndex]
      if (
        manager.constructors.includes(constructorName) &&
        currentSlotConstructor !== constructorName
      ) {
        return previous
      }

      const driversMap = getDriversMap(previous.drivers)
      const constructorsMap = getConstructorsMap(previous.constructors)

      const nextManagers = previous.managers.map((entry) => {
        if (entry.id !== manager.id) {
          return entry
        }

        const nextConstructors = Array.from(
          { length: MAX_CONSTRUCTORS },
          (_, index) => entry.constructors[index] ?? '',
        )
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

  const resetHumanLineup = useCallback(() => {
    setState((previous) => {
      const driversMap = getDriversMap(previous.drivers)
      const constructorsMap = getConstructorsMap(previous.constructors)

      return {
        ...previous,
        managers: previous.managers.map((manager) => {
          if (!manager.isHuman) {
            return manager
          }

          const restoredDrivers = manager.lockedDrivers ?? []
          const restoredConstructors = manager.lockedConstructors ?? []
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
              activeChip: null,
              backupDrivers: undefined,
              backupConstructors: undefined,
              backupBudget: undefined,
            },
            driversMap,
            constructorsMap,
          )
        }),
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
        scoreManager(manager, roundData, driversMap, constructorsMap, isSeasonOpener, previous.selectedSeason ?? undefined),
      )

      const driverRoundScores = buildDriverScoreMap(roundData)
      const constructorRoundScores = buildConstructorScoreMap(roundData, previous.selectedSeason ?? undefined)

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

      // Read auto-navigate preference (separate from game save data).
      const autoNavigate = (() => {
        try {
          return localStorage.getItem('f1_fantasy_auto_navigate') !== 'false'
        } catch {
          return true
        }
      })()
      const nextView = isSeasonComplete
        ? previous.currentView
        : autoNavigate
          ? 'dashboard'
          : previous.currentView

      const nextState = {
        ...previous,
        drivers: nextDrivers,
        constructors: nextConstructors,
        managers: updatedManagers,
        currentRound: nextRound,
        isSeasonComplete,
        lastProcessedRound: previous.currentRound,
        roundResults: [...previous.roundResults, roundResults],
        currentView: nextView,
      }

      // Auto-save after processing a round.
      try {
        writeSaveFile(nextState)
      } catch {
        // localStorage may be unavailable — silently skip.
      }

      return nextState
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
      hasSavedGame: hasSavedGame(),
      selectSeason,
      exitToSeasonSelect,
      restartSeason,
      resetSeason,
      saveGame,
      loadSavedGame,
      setCurrentView,
      replaceDriver,
      replaceConstructor,
      resetHumanLineup,
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
      resetHumanLineup,
      restartSeason,
      resetSeason,
      saveGame,
      loadSavedGame,
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
