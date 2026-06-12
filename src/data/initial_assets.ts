import type { ConstructorAsset, DriverAsset, SeasonData } from '../types'

export interface DriverSeed {
  abbreviation: string
  fullName: string
  team: string
  defaultPrice: number
}

export interface ConstructorSeed {
  name: string
  defaultPrice: number
}

export const DRIVER_SEEDS: DriverSeed[] = [
  { abbreviation: 'VER', fullName: 'Max Verstappen', team: 'Red Bull Racing', defaultPrice: 30.5 },
  { abbreviation: 'PER', fullName: 'Sergio Perez', team: 'Red Bull Racing', defaultPrice: 24.2 },
  { abbreviation: 'NOR', fullName: 'Lando Norris', team: 'McLaren', defaultPrice: 24.8 },
  { abbreviation: 'PIA', fullName: 'Oscar Piastri', team: 'McLaren', defaultPrice: 20.1 },
  { abbreviation: 'LEC', fullName: 'Charles Leclerc', team: 'Ferrari', defaultPrice: 23.7 },
  { abbreviation: 'SAI', fullName: 'Carlos Sainz', team: 'Ferrari', defaultPrice: 21.9 },
  { abbreviation: 'HAM', fullName: 'Lewis Hamilton', team: 'Mercedes', defaultPrice: 21.4 },
  { abbreviation: 'RUS', fullName: 'George Russell', team: 'Mercedes', defaultPrice: 19.9 },
  { abbreviation: 'ALO', fullName: 'Fernando Alonso', team: 'Aston Martin', defaultPrice: 16.1 },
  { abbreviation: 'STR', fullName: 'Lance Stroll', team: 'Aston Martin', defaultPrice: 10.8 },
  { abbreviation: 'GAS', fullName: 'Pierre Gasly', team: 'Alpine', defaultPrice: 10.4 },
  { abbreviation: 'OCO', fullName: 'Esteban Ocon', team: 'Alpine', defaultPrice: 9.6 },
  { abbreviation: 'ALB', fullName: 'Alex Albon', team: 'Williams', defaultPrice: 11.3 },
  { abbreviation: 'SAR', fullName: 'Logan Sargeant', team: 'Williams', defaultPrice: 7.1 },
  { abbreviation: 'TSU', fullName: 'Yuki Tsunoda', team: 'RB', defaultPrice: 9.9 },
  { abbreviation: 'RIC', fullName: 'Daniel Ricciardo', team: 'RB', defaultPrice: 8.4 },
  { abbreviation: 'HUL', fullName: 'Nico Hulkenberg', team: 'Haas F1 Team', defaultPrice: 8.7 },
  { abbreviation: 'MAG', fullName: 'Kevin Magnussen', team: 'Haas F1 Team', defaultPrice: 7.9 },
  { abbreviation: 'BOT', fullName: 'Valtteri Bottas', team: 'Stake F1 Team Kick Sauber', defaultPrice: 7.2 },
  { abbreviation: 'ZHO', fullName: 'Zhou Guanyu', team: 'Stake F1 Team Kick Sauber', defaultPrice: 6.8 },
]

export const CONSTRUCTOR_SEEDS: ConstructorSeed[] = [
  { name: 'Red Bull Racing', defaultPrice: 28.4 },
  { name: 'Ferrari', defaultPrice: 26.2 },
  { name: 'McLaren', defaultPrice: 25.6 },
  { name: 'Mercedes', defaultPrice: 22.8 },
  { name: 'Aston Martin', defaultPrice: 16.4 },
  { name: 'Alpine', defaultPrice: 12.2 },
  { name: 'Renault', defaultPrice: 12.2 },
  { name: 'Williams', defaultPrice: 11.4 },
  { name: 'RB F1 Team', defaultPrice: 10.7 },
  { name: 'AlphaTauri', defaultPrice: 10.7 },
  { name: 'Toro Rosso', defaultPrice: 10.7 },
  { name: 'Haas F1 Team', defaultPrice: 9.8 },
  { name: 'Stake F1 Team Kick Sauber', defaultPrice: 8.9 },
  { name: 'Sauber', defaultPrice: 8.9 },
  { name: 'Alfa Romeo Sauber', defaultPrice: 8.9 },
  { name: 'Racing Point', defaultPrice: 12.5 },
  { name: 'Force India', defaultPrice: 12.5 },
]

export const DRIVER_SEED_MAP = new Map(DRIVER_SEEDS.map((seed) => [seed.abbreviation, seed]))
export const CONSTRUCTOR_SEED_MAP = new Map(CONSTRUCTOR_SEEDS.map((seed) => [seed.name, seed]))

const clampPrice = (value: number) => Math.max(3, Math.min(35, Number(value.toFixed(1))))

const getDriverScoreHint = (seasonData: SeasonData, abbreviation: string) => {
  const firstRound = seasonData.rounds[0]
  if (!firstRound) {
    return 0
  }

  const qualifying = firstRound.qualifying.results.find((entry) => entry.driver === abbreviation)
  const sprint = firstRound.sprint?.results.find((entry) => entry.driver === abbreviation)
  const race = firstRound.race.results.find((entry) => entry.driver === abbreviation)

  const qualifyingPoints = qualifying ? Math.max(0, 11 - qualifying.position) : 0
  const sprintPoints = sprint ? Math.max(0, 9 - sprint.position) : 0
  const racePoints = race?.points ?? 0

  return qualifyingPoints + sprintPoints + racePoints
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

const normalizeName = (raw: string, season?: number): string => {
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

const getConstructorScoreHint = (seasonData: SeasonData, constructor: string) => {
  const firstRound = seasonData.rounds[0]
  if (!firstRound) {
    return 0
  }

  return firstRound.race.results
    .filter((entry) => normalizeName(entry.team, seasonData.season) === constructor)
    .reduce((sum, entry) => sum + (entry.points ?? 0), 0)
}

export const buildInitialDrivers = (seasonData: SeasonData): DriverAsset[] => {
  const seen = new Map<string, DriverAsset>()

  for (const round of seasonData.rounds) {
    for (const result of round.race.results) {
      if (seen.has(result.driver)) {
        continue
      }

      const seed = DRIVER_SEED_MAP.get(result.driver)
      const fallbackBase = 6 + getDriverScoreHint(seasonData, result.driver) * 0.65
      seen.set(result.driver, {
        abbreviation: result.driver,
        fullName: result.fullName,
        team: result.team,
        price: clampPrice(seed?.defaultPrice ?? fallbackBase),
        fantasyPoints: 0,
        recentScores: [],
        lastPriceChange: 0,
      })
    }
  }

  return Array.from(seen.values()).sort((left, right) => right.price - left.price)
}

export const buildInitialConstructors = (seasonData: SeasonData): ConstructorAsset[] => {
  const seen = new Map<string, ConstructorAsset>()

  for (const round of seasonData.rounds) {
    for (const stop of round.race.pitStops) {
      const key = normalizeName(stop.constructor, seasonData.season)
      if (seen.has(key)) {
        continue
      }

      const seed = CONSTRUCTOR_SEED_MAP.get(key)
      const fallbackBase = 8 + getConstructorScoreHint(seasonData, key) * 0.9
      seen.set(key, {
        name: key,
        price: clampPrice(seed?.defaultPrice ?? fallbackBase),
        fantasyPoints: 0,
        recentScores: [],
        lastPriceChange: 0,
      })
    }
  }

  for (const result of seasonData.rounds[0]?.race.results ?? []) {
    const key = normalizeName(result.team, seasonData.season)
    if (seen.has(key)) {
      continue
    }

    const seed = CONSTRUCTOR_SEED_MAP.get(key)
    const fallbackBase = 8 + getConstructorScoreHint(seasonData, key) * 0.9
    seen.set(key, {
      name: key,
      price: clampPrice(seed?.defaultPrice ?? fallbackBase),
      fantasyPoints: 0,
      recentScores: [],
      lastPriceChange: 0,
    })
  }

  return Array.from(seen.values()).sort((left, right) => right.price - left.price)
}
