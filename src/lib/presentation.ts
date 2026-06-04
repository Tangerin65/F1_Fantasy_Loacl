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
// Team name normalization — maps inconsistent names across
// seasons to a single canonical key for display.
// -----------------------------------------------------------
export const normalizeTeamName = (team: string, season?: number): string => {
  const lower = team.toLowerCase()

  if (lower.includes('red bull')) return 'Red Bull Racing'
  if (lower.includes('ferrari')) return 'Ferrari'
  if (lower.includes('mclaren')) return 'McLaren'
  if (lower.includes('mercedes')) return 'Mercedes'
  if (lower.includes('aston martin')) return 'Aston Martin'

  if (lower.includes('alpine')) return 'Alpine'

  if (lower.includes('williams')) return 'Williams'

  if (
    lower.includes('rb') ||
    lower.includes('racing bulls') ||
    lower.includes('alphatauri') ||
    lower.includes('alpha tauri') ||
    lower.includes('tororosso') ||
    lower.includes('toro rosso')
  ) {
    if (season && season >= 2024) return 'RB F1 Team'
    if (season && season >= 2020) return 'AlphaTauri'
    return 'Toro Rosso'
  }

  if (lower.includes('haas')) return 'Haas F1 Team'

  if (
    lower.includes('sauber') ||
    lower.includes('alfa romeo') ||
    lower.includes('alfa') ||
    lower.includes('kick') ||
    lower.includes('stake')
  ) return 'Sauber'

  return team
}

// -----------------------------------------------------------
// Team colour palette — keyed by canonical name.
// -----------------------------------------------------------
interface TeamPalette {
  base: string
  edge: string
  text?: string
  gradient?: string // multi-stop gradient override (e.g. for season-specific Sauber)
}

const TEAM_COLORS_BASE: Record<string, TeamPalette> = {
  'Red Bull Racing': { base: '#1e3a8a', edge: '#dc2626' },
  Ferrari: { base: '#8f0d12', edge: '#ff6b57' },
  McLaren: { base: '#9a3412', edge: '#ff8a00' },
  Mercedes: { base: '#0f766e', edge: '#9ff7e8' },
  'Aston Martin': { base: '#14532d', edge: '#4ade80' },
  Alpine: { base: '#1d4ed8', edge: '#f472b6' },
  Williams: { base: '#1d4ed8', edge: '#93c5fd' },
  RB: { base: '#312e81', edge: '#60a5fa' },
  'Haas F1 Team': { base: '#3f3f46', edge: '#ef4444' },
}

// Sauber / Alfa Romeo has a different gradient each season.
const SAUBER_COLORS: Record<number, TeamPalette> = {
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

// Seasons <=2022 all use the 2022 palette.
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

  if (canonical === 'Sauber') {
    return getSauberColors(season)
  }

  return TEAM_COLORS_BASE[canonical] ?? FALLBACK_PALETTE
}

export const getTeamSurfaceStyle = (team?: string, season?: number): CSSProperties => {
  const palette = getTeamColors(team, season)
  return {
    background: palette.gradient ?? `linear-gradient(135deg, ${palette.base}, ${palette.edge})`,
    color: palette.text ?? '#f8fafc',
  }
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
