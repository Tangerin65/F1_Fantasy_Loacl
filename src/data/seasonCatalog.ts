import type { SeasonData } from '../types'
import { demoSeason2024 } from './demoSeason2024'

export interface SeasonCatalogEntry {
  season: number
  label: string
  source: 'json' | 'fixture'
  data: SeasonData
}

const rawSeasonModules = import.meta.glob('./seasons/*.json', { eager: true })

const normalizeSeasonData = (value: unknown): SeasonData | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const maybeModule = value as { default?: SeasonData }
  return maybeModule.default ?? (value as SeasonData)
}

export const getSeasonCatalog = (): SeasonCatalogEntry[] => {
  const catalog = new Map<number, SeasonCatalogEntry>()

  for (const rawModule of Object.values(rawSeasonModules)) {
    const seasonData = normalizeSeasonData(rawModule)
    if (!seasonData) {
      continue
    }

    catalog.set(seasonData.season, {
      season: seasonData.season,
      label: `${seasonData.season} Real Season`,
      source: 'json',
      data: seasonData,
    })
  }

  if (!catalog.has(demoSeason2024.season)) {
    catalog.set(demoSeason2024.season, {
      season: demoSeason2024.season,
      label: `${demoSeason2024.season} Dev Fixture`,
      source: 'fixture',
      data: demoSeason2024,
    })
  }

  return Array.from(catalog.values()).sort((left, right) => right.season - left.season)
}
