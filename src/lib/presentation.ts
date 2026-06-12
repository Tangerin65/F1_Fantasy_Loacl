import type { CSSProperties } from 'react'
import type { RoundData } from '../types'

type UiLanguage = 'en' | 'zh'

const browserLanguage: UiLanguage =
  typeof navigator !== 'undefined' &&
  navigator.language.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'en'

let activeLanguage: UiLanguage = browserLanguage

export const setUiLanguage = (language: UiLanguage) => {
  activeLanguage = language
}

export const getUiLanguage = () => activeLanguage

export const isChineseUi = () => activeLanguage === 'zh'

export const copyText = (english: string, chinese: string) =>
  isChineseUi() ? chinese : english

// -----------------------------------------------------------
// RB-family helpers (shared between normalisation functions)
// -----------------------------------------------------------
const isRbFamily = (lower: string): boolean =>
  lower.includes('rb') ||
  lower.includes('racing bulls') ||
  lower.includes('alphatauri') ||
  lower.includes('alpha tauri') ||
  lower.includes('tororosso') ||
  lower.includes('toro rosso')

// -----------------------------------------------------------
// Team name normalization — maps inconsistent names across
// seasons to a single canonical key for display.
//
// Rules are season-aware so that a historical entity that
// raced under multiple names collapses to the correct
// canonical form for the chosen season.
// -----------------------------------------------------------
export const normalizeTeamName = (team: string, season?: number): string => {
  const lower = team.toLowerCase()

  if (lower.includes('red bull')) return 'Red Bull Racing'
  if (lower.includes('ferrari')) return 'Ferrari'
  if (lower.includes('mclaren')) return 'McLaren'
  if (lower.includes('mercedes')) return 'Mercedes'
  if (lower.includes('williams')) return 'Williams'
  if (lower.includes('haas')) return 'Haas F1 Team'

  // RB family (Toro Rosso / AlphaTauri / RB F1 Team / Racing Bulls)
  if (isRbFamily(lower)) {
    if (season && season >= 2024) return 'RB F1 Team'
    if (season && season >= 2020) return 'AlphaTauri'
    return 'Toro Rosso'
  }

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

  return team
}

// -----------------------------------------------------------
// Team colour palette — keyed by canonical name.
// -----------------------------------------------------------
interface TeamPalette {
  base: string
  edge: string
  text?: string
  gradient?: string // multi-stop gradient override
}

// Base palette — used as a fallback when no season-specific
// override exists for the given canonical team name.
const TEAM_COLORS_BASE: Record<string, TeamPalette> = {
  'Red Bull Racing': { base: '#1E1A78', edge: '#E10600' },
  Ferrari: { base: '#DC0000', edge: '#111111' },
  McLaren: {
    base: '#FF8700',
    edge: '#0057B8',
    gradient: 'linear-gradient(135deg, #FF8700 0%, #FF8700 65%, #0057B8 100%)',
  },
  Mercedes: { base: '#00D2BE', edge: '#00D2BE' },
  'Aston Martin': {
    base: '#006F62',
    edge: '#CEDC00',
    gradient: 'linear-gradient(135deg, #006F62 0%, #006F62 70%, #CEDC00 100%)',
  },
  Alpine: { base: '#005BA9', edge: '#F3A6C8' },
  Williams: { base: '#003DA5', edge: '#00A3E0' },
  'Haas F1 Team': { base: '#111111', edge: '#E0E0E0' },
  'Toro Rosso': { base: '#1F4FA3', edge: '#C0C7D1' },
  AlphaTauri: { base: '#1C2D4A', edge: '#E0E0E0' },
  'RB F1 Team': { base: '#1434CB', edge: '#E0E0E0' },
  Renault: {
    base: '#FFD200',
    edge: '#050505',
    gradient: 'linear-gradient(135deg, #FFD200 0%, #FFD200 65%, #050505 100%)',
  },
  'Racing Point': { base: '#F3A6C8', edge: '#0072CE' },
  'Force India': { base: '#F3A6C8', edge: '#E8E8E8' },
  'Alfa Romeo Sauber': { base: '#8A1538', edge: '#E0E0E0' },
}

// Season-specific overrides — applied on top of the base palette.
// Key format: "<season>:<canonical team name>"
const SEASON_TEAM_OVERRIDES: Record<string, TeamPalette> = {
  // Ferrari — alternates between white (dimmed) and black as the second colour
  '2018:Ferrari': { base: '#DC0000', edge: '#E0E0E0' },
  '2020:Ferrari': { base: '#DC0000', edge: '#E0E0E0' },
  '2022:Ferrari': { base: '#DC0000', edge: '#111111', text: '#FFD200' },
  '2024:Ferrari': { base: '#DC0000', edge: '#E0E0E0' },
  '2025:Ferrari': { base: '#B80000', edge: '#E0E0E0', text: '#0072CE' },

  // Mercedes — 2024/2025 carrie sur le schéma 2023
  '2020:Mercedes': { base: '#050505', edge: '#00D2BE', text: '#C0C0C0' },
  '2021:Mercedes': { base: '#050505', edge: '#00D2BE', text: '#C0C0C0' },
  '2022:Mercedes': { base: '#00D2BE', edge: '#C0C0C0', text: '#111111' },
  '2023:Mercedes': { base: '#050505', edge: '#00D2BE', text: '#C0C0C0' },
  '2024:Mercedes': { base: '#050505', edge: '#00D2BE', text: '#C0C0C0' },
  '2025:Mercedes': { base: '#050505', edge: '#00D2BE', text: '#C0C0C0' },

  // Red Bull Racing — gold accent in 2025
  '2025:Red Bull Racing': { base: '#1E1A78', edge: '#E10600', text: '#FCD700' },

  // McLaren — orange dominant, black accent from 2024
  '2024:McLaren': {
    base: '#FF8700',
    edge: '#111111',
    text: '#0057B8',
    gradient: 'linear-gradient(135deg, #FF8700 0%, #FF8700 65%, #111111 100%)',
  },
  '2025:McLaren': {
    base: '#FF8700',
    edge: '#111111',
    text: '#0057B8',
    gradient: 'linear-gradient(135deg, #FF8700 0%, #FF8700 65%, #111111 100%)',
  },

  // Aston Martin — dark green dominant
  '2025:Aston Martin': {
    base: '#006F62',
    edge: '#CEDC00',
    text: '#C0C0C0',
    gradient: 'linear-gradient(135deg, #006F62 0%, #006F62 70%, #CEDC00 100%)',
  },

  // Alpine — black accent in 2025
  '2025:Alpine': { base: '#005BA9', edge: '#F3A6C8', text: '#111111' },

  // Williams — completely different liveries per era
  '2018:Williams': { base: '#E0E0E0', edge: '#E0E0E0' },
  '2019:Williams': { base: '#E0E0E0', edge: '#00A3E0' },
  '2020:Williams': { base: '#005AFF', edge: '#E0E0E0', text: '#001E60' },
  '2021:Williams': { base: '#003DA5', edge: '#00A3E0', text: '#FFD200' },
  '2022:Williams': { base: '#003DA5', edge: '#00A3E0', text: '#111111' },
  '2023:Williams': { base: '#003DA5', edge: '#00A3E0', text: '#111111' },
  '2024:Williams': { base: '#003DA5', edge: '#00A3E0', text: '#111111' },
  '2025:Williams': { base: '#003DA5', edge: '#00A3E0', text: '#FFFFFF' },

  // Haas — very different liveries per season
  '2018:Haas F1 Team': { base: '#111111', edge: '#E10600', text: '#FFFFFF' },
  '2019:Haas F1 Team': { base: '#C9A646', edge: '#E0E0E0', text: '#111111' },
  '2020:Haas F1 Team': { base: '#E0E0E0', edge: '#E10600', text: '#111111' },
  '2021:Haas F1 Team': {
    base: '#0033A0',
    edge: '#D52B1E',
    text: '#111111',
    gradient: 'linear-gradient(135deg, #0033A0 0%, #0033A0 33%, #E0E0E0 33%, #E0E0E0 67%, #D52B1E 67%, #D52B1E 100%)',
  },
  '2022:Haas F1 Team': { base: '#E0E0E0', edge: '#D0021B', text: '#0033A0' },
  '2023:Haas F1 Team': {
    base: '#0B0B0B',
    edge: '#D0D0D0',
    text: '#E10600',
    gradient: 'linear-gradient(135deg, #0B0B0B 0%, #E10600 50%, #D0D0D0 100%)',
  },
  '2024:Haas F1 Team': {
    base: '#111111',
    edge: '#D0D0D0',
    text: '#E10600',
    gradient: 'linear-gradient(135deg, #111111 0%, #E10600 50%, #D0D0D0 100%)',
  },
  '2025:Haas F1 Team': { base: '#E0E0E0', edge: '#111111', text: '#E10600' },

  // Toro Rosso — same across its two seasons
  '2019:Toro Rosso': { base: '#1F4FA3', edge: '#C0C7D1' },

  // AlphaTauri — dimmed white edge for readability
  '2021:AlphaTauri': { base: '#1C2D4A', edge: '#E0E0E0', text: '#BFC7D5' },
  '2022:AlphaTauri': { base: '#1C2D4A', edge: '#E0E0E0', text: '#BFC7D5' },
  '2023:AlphaTauri': { base: '#1C2D4A', edge: '#E0E0E0', text: '#E10600' },

  // Racing Point
  '2019:Racing Point': { base: '#F3A6C8', edge: '#0072CE', text: '#FFFFFF' },
  '2020:Racing Point': { base: '#F3A6C8', edge: '#0072CE', text: '#FFFFFF' },
}

// Sauber / Alfa Romeo has a completely different livery each season.
const SAUBER_COLORS: Record<number, TeamPalette> = {
  2018: { base: '#8A1538', edge: '#E0E0E0', text: '#0B1F3A' },
  2019: { base: '#A00000', edge: '#E0E0E0', text: '#111111' },
  2020: { base: '#9B111E', edge: '#E0E0E0', text: '#111111' },
  2021: { base: '#9B111E', edge: '#E0E0E0', text: '#111111' },
  2022: { base: '#7A0C15', edge: '#B11226', text: '#F4F1EA' },
  2023: {
    base: '#050505',
    edge: '#1A1A1A',
    text: '#E10600',
    gradient: 'linear-gradient(135deg, #050505, #1A1A1A, #9E0B16, #E10600)',
  },
  2024: { base: '#000000', edge: '#52FF00', text: '#B8FF00' },
  2025: { base: '#050505', edge: '#00D100', text: '#B6FF00' },
}

const SAUBER_FALLBACK_SEASON = 2022

const getSauberColors = (season?: number): TeamPalette => {
  if (season && SAUBER_COLORS[season]) {
    return SAUBER_COLORS[season]
  }
  return SAUBER_COLORS[SAUBER_FALLBACK_SEASON]
}

const FALLBACK_PALETTE: TeamPalette = { base: '#202531', edge: '#535d73' }

export const getTeamColors = (team?: string, season?: number): TeamPalette => {
  if (!team) return FALLBACK_PALETTE

  const canonical = normalizeTeamName(team)

  // Sauber family (includes Alfa Romeo Sauber)
  if (canonical === 'Sauber' || canonical === 'Alfa Romeo Sauber') {
    return getSauberColors(season)
  }

  // Season-specific override
  const overrideKey = season ? `${season}:${canonical}` : ''
  if (overrideKey && SEASON_TEAM_OVERRIDES[overrideKey]) {
    return SEASON_TEAM_OVERRIDES[overrideKey]
  }

  return TEAM_COLORS_BASE[canonical] ?? FALLBACK_PALETTE
}

export const getTeamSurfaceStyle = (team?: string, season?: number): CSSProperties => {
  const palette = getTeamColors(team, season)
  const surface = palette.gradient ?? `linear-gradient(135deg, ${palette.base}, ${palette.edge})`
  return {
    '--team-surface': surface,
    '--team-text': palette.text ?? '#f8fafc',
    color: 'var(--team-text)',
  } as CSSProperties
}

// -----------------------------------------------------------
// Driver numbers
// -----------------------------------------------------------
const DRIVER_NUMBERS: Record<string, string> = {
  VER: '1',
  PER: '11',
  NOR: '4',
  PIA: '81',
  LEC: '16',
  SAI: '55',
  HAM: '44',
  RUS: '63',
  ALO: '14',
  STR: '18',
  GAS: '10',
  OCO: '31',
  ALB: '23',
  SAR: '2',
  TSU: '22',
  RIC: '3',
  HUL: '27',
  MAG: '20',
  BOT: '77',
  ZHO: '24',
  BEA: '87',
  LAW: '30',
  BOR: '5',
  DOO: '7',
  HAD: '6',
  DEV: '21',
  MSC: '47',
  LAT: '6',
  ANT: '12',
  // Historical drivers
  VET: '5',
  RAI: '7',
  GRO: '8',
  VAN: '2',
  HAR: '28',
  ERI: '9',
  SIR: '35',
  KVY: '26',
  GIO: '99',
  KUB: '88',
  AIT: '89',
  FIT: '51',
  MAZ: '9',
}

export const getDriverNumber = (abbreviation: string) =>
  DRIVER_NUMBERS[abbreviation] ?? '--'

export const formatDriverNameTwoLines = (fullName: string) => {
  const nameParts = fullName.split(' ')
  if (nameParts.length < 2) {
    return fullName
  }

  const surname = nameParts.pop()
  return `${nameParts.join(' ')}\n${surname}`
}

export const getRoundActiveDrivers = (roundData: RoundData | null) => {
  if (!roundData) {
    return new Set<string>()
  }

  return new Set([
    ...roundData.qualifying.results.map((entry) => entry.driver),
    ...(roundData.sprint?.results.map((entry) => entry.driver) ?? []),
    ...roundData.race.results.map((entry) => entry.driver),
  ])
}

export const getOvertakeLeaders = (roundData: RoundData) =>
  [...roundData.race.results]
    .map((entry) => ({
      driver: entry.driver,
      fullName: entry.fullName,
      team: entry.team,
      gained: entry.grid - entry.position,
      finish: entry.position,
    }))
    .sort((left, right) => right.gained - left.gained || left.finish - right.finish)
