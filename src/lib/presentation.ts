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

const TEAM_COLORS: Record<string, { base: string; edge: string; text?: string }> = {
  'Red Bull Racing': { base: '#1e3a8a', edge: '#dc2626' },
  Ferrari: { base: '#8f0d12', edge: '#ff6b57' },
  McLaren: { base: '#9a3412', edge: '#ff8a00' },
  Mercedes: { base: '#0f766e', edge: '#9ff7e8' },
  'Aston Martin': { base: '#14532d', edge: '#4ade80' },
  Alpine: { base: '#1d4ed8', edge: '#f472b6' },
  Williams: { base: '#1d4ed8', edge: '#93c5fd' },
  RB: { base: '#312e81', edge: '#60a5fa' },
  'Haas F1 Team': { base: '#3f3f46', edge: '#ef4444' },
  'Stake F1 Team Kick Sauber': { base: '#14532d', edge: '#84cc16' },
}

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
}

export const getDriverNumber = (abbreviation: string) =>
  DRIVER_NUMBERS[abbreviation] ?? '--'

export const getTeamColors = (team?: string) =>
  (team && TEAM_COLORS[team]) || { base: '#202531', edge: '#535d73' }

export const getTeamSurfaceStyle = (team?: string): CSSProperties => {
  const palette = getTeamColors(team)
  return {
    background: `linear-gradient(135deg, ${palette.base}, ${palette.edge})`,
    borderColor: `${palette.edge}66`,
    color: palette.text ?? '#f8fafc',
  }
}

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
