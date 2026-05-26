import type { PitStopData, QualifyingResult, RaceResult, RoundData, SeasonData, SprintResult } from '../types'
import { DRIVER_SEEDS } from './initial_assets'

const DRIVER_DIRECTORY = new Map(
  DRIVER_SEEDS.map((seed) => [
    seed.abbreviation,
    {
      fullName: seed.fullName,
      team: seed.team,
    },
  ]),
)

const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

const timeString = (position: number, baseMinute: number, baseSecond: number, spread: number) => {
  const seconds = baseSecond + position * spread
  return `${baseMinute}:${seconds.toFixed(3).padStart(6, '0')}`
}

const makeQualifying = (
  order: string[],
  eliminatedInQ2: string[],
  eliminatedInQ1: string[],
  statusOverrides: Partial<Record<string, string>> = {},
): QualifyingResult[] =>
  order.map((driver, index) => {
    const directory = DRIVER_DIRECTORY.get(driver)
    const position = index + 1
    const q2Cut = eliminatedInQ2.includes(driver)
    const q1Cut = eliminatedInQ1.includes(driver)

    return {
      driver,
      fullName: directory?.fullName ?? driver,
      team: directory?.team ?? 'Independent',
      position,
      q1: timeString(position, 1, 29.1, 0.118),
      q2: q1Cut ? null : timeString(position, 1, 28.4, 0.126),
      q3: q1Cut || q2Cut ? null : timeString(position, 1, 27.8, 0.141),
      status: statusOverrides[driver] ?? 'Finished',
    }
  })

const makeRace = (
  finishOrder: string[],
  gridOrder: string[],
  fastestLapDriver: string,
  statusOverrides: Partial<Record<string, string>> = {},
): { results: RaceResult[]; fastestLapDriver: string } => ({
  results: finishOrder.map((driver, index) => {
    const directory = DRIVER_DIRECTORY.get(driver)
    return {
      driver,
      fullName: directory?.fullName ?? driver,
      team: directory?.team ?? 'Independent',
      grid: gridOrder.indexOf(driver) + 1,
      position: index + 1,
      status: statusOverrides[driver] ?? 'Finished',
      points: RACE_POINTS[index] ?? 0,
    }
  }),
  fastestLapDriver,
})

const makeSprint = (
  finishOrder: string[],
  gridOrder: string[],
  fastestLapDriver: string,
  statusOverrides: Partial<Record<string, string>> = {},
): { results: SprintResult[]; fastestLapDriver: string } => ({
  results: finishOrder.map((driver, index) => {
    const directory = DRIVER_DIRECTORY.get(driver)
    return {
      driver,
      fullName: directory?.fullName ?? driver,
      team: directory?.team ?? 'Independent',
      grid: gridOrder.indexOf(driver) + 1,
      position: index + 1,
      status: statusOverrides[driver] ?? 'Finished',
      points: Math.max(0, 8 - index),
    }
  }),
  fastestLapDriver,
})

const makePitStops = (entries: Array<[string, number]>): PitStopData[] =>
  entries.map(([constructor, fastestStop]) => ({ constructor, fastestStop }))

const buildRound = (input: {
  round: number
  raceName: string
  country: string
  date: string
  qualifyingOrder: string[]
  q2Eliminated: string[]
  q1Eliminated: string[]
  raceGrid: string[]
  raceFinish: string[]
  raceFastestLapDriver: string
  pitStops: Array<[string, number]>
  sprintGrid?: string[]
  sprintFinish?: string[]
  sprintFastestLapDriver?: string
  qualifyingStatus?: Partial<Record<string, string>>
  raceStatus?: Partial<Record<string, string>>
  sprintStatus?: Partial<Record<string, string>>
}): RoundData => ({
  round: input.round,
  raceName: input.raceName,
  country: input.country,
  date: input.date,
  isSprint: Boolean(input.sprintFinish && input.sprintGrid && input.sprintFastestLapDriver),
  qualifying: {
    results: makeQualifying(
      input.qualifyingOrder,
      input.q2Eliminated,
      input.q1Eliminated,
      input.qualifyingStatus,
    ),
  },
  sprint:
    input.sprintFinish && input.sprintGrid && input.sprintFastestLapDriver
      ? makeSprint(
          input.sprintFinish,
          input.sprintGrid,
          input.sprintFastestLapDriver,
          input.sprintStatus,
        )
      : null,
  race: {
    ...makeRace(
      input.raceFinish,
      input.raceGrid,
      input.raceFastestLapDriver,
      input.raceStatus,
    ),
    pitStops: makePitStops(input.pitStops),
  },
})

const round1Order = [
  'VER', 'LEC', 'RUS', 'SAI', 'PER', 'ALO', 'NOR', 'PIA', 'HAM', 'TSU',
  'STR', 'ALB', 'RIC', 'GAS', 'OCO', 'HUL', 'BOT', 'MAG', 'ZHO', 'SAR',
]

const round2Qualifying = [
  'VER', 'LEC', 'PER', 'ALO', 'PIA', 'NOR', 'RUS', 'HAM', 'TSU', 'STR',
  'ALB', 'RIC', 'SAI', 'GAS', 'OCO', 'HUL', 'MAG', 'BOT', 'ZHO', 'SAR',
]

const round3Qualifying = [
  'VER', 'SAI', 'NOR', 'LEC', 'PIA', 'RUS', 'HAM', 'ALO', 'PER', 'TSU',
  'ALB', 'STR', 'RIC', 'GAS', 'OCO', 'HUL', 'BOT', 'MAG', 'ZHO', 'SAR',
]

const round4Qualifying = [
  'VER', 'PER', 'ALO', 'NOR', 'SAI', 'LEC', 'PIA', 'RUS', 'HAM', 'TSU',
  'ALB', 'RIC', 'STR', 'HUL', 'BOT', 'MAG', 'OCO', 'GAS', 'ZHO', 'SAR',
]

export const demoSeason2024: SeasonData = {
  season: 2024,
  rounds: [
    buildRound({
      round: 1,
      raceName: 'Bahrain Grand Prix',
      country: 'Bahrain',
      date: '2024-03-02',
      qualifyingOrder: round1Order,
      q2Eliminated: ['TSU', 'STR', 'ALB', 'RIC', 'GAS'],
      q1Eliminated: ['OCO', 'HUL', 'BOT', 'MAG', 'ZHO', 'SAR'],
      raceGrid: round1Order,
      raceFinish: [
        'VER', 'PER', 'SAI', 'LEC', 'RUS', 'NOR', 'HAM', 'PIA', 'ALO', 'TSU',
        'STR', 'ALB', 'RIC', 'GAS', 'OCO', 'HUL', 'BOT', 'MAG', 'ZHO', 'SAR',
      ],
      raceFastestLapDriver: 'VER',
      pitStops: [
        ['Ferrari', 21.12],
        ['McLaren', 21.66],
        ['Red Bull Racing', 21.93],
        ['Mercedes', 22.20],
        ['Aston Martin', 22.48],
        ['RB', 22.63],
        ['Williams', 22.79],
        ['Alpine', 23.14],
        ['Haas F1 Team', 23.28],
        ['Stake F1 Team Kick Sauber', 23.52],
      ],
    }),
    buildRound({
      round: 2,
      raceName: 'Saudi Arabian Grand Prix',
      country: 'Saudi Arabia',
      date: '2024-03-09',
      qualifyingOrder: round2Qualifying,
      q2Eliminated: ['STR', 'ALB', 'RIC', 'SAI', 'GAS'],
      q1Eliminated: ['OCO', 'HUL', 'MAG', 'BOT', 'ZHO', 'SAR'],
      raceGrid: round2Qualifying,
      raceFinish: [
        'VER', 'LEC', 'NOR', 'PIA', 'PER', 'ALO', 'RUS', 'HAM', 'TSU', 'STR',
        'ALB', 'RIC', 'SAI', 'GAS', 'OCO', 'HUL', 'MAG', 'BOT', 'ZHO', 'SAR',
      ],
      raceFastestLapDriver: 'LEC',
      raceStatus: { SAR: 'DNF' },
      pitStops: [
        ['Red Bull Racing', 20.98],
        ['Ferrari', 21.18],
        ['Mercedes', 21.74],
        ['McLaren', 21.83],
        ['Aston Martin', 22.05],
        ['RB', 22.34],
        ['Williams', 22.58],
        ['Haas F1 Team', 22.74],
        ['Alpine', 22.89],
        ['Stake F1 Team Kick Sauber', 23.20],
      ],
    }),
    buildRound({
      round: 3,
      raceName: 'Australian Grand Prix',
      country: 'Australia',
      date: '2024-03-24',
      qualifyingOrder: round3Qualifying,
      q2Eliminated: ['TSU', 'ALB', 'STR', 'RIC', 'GAS'],
      q1Eliminated: ['OCO', 'HUL', 'BOT', 'MAG', 'ZHO', 'SAR'],
      raceGrid: round3Qualifying,
      raceFinish: [
        'SAI', 'LEC', 'NOR', 'PIA', 'PER', 'RUS', 'HAM', 'ALO', 'TSU', 'ALB',
        'STR', 'RIC', 'GAS', 'OCO', 'HUL', 'BOT', 'MAG', 'ZHO', 'SAR', 'VER',
      ],
      raceFastestLapDriver: 'NOR',
      raceStatus: { VER: 'DNF' },
      pitStops: [
        ['Ferrari', 21.04],
        ['McLaren', 21.39],
        ['Mercedes', 21.72],
        ['Red Bull Racing', 21.96],
        ['Aston Martin', 22.11],
        ['RB', 22.45],
        ['Williams', 22.64],
        ['Alpine', 22.88],
        ['Haas F1 Team', 23.06],
        ['Stake F1 Team Kick Sauber', 23.31],
      ],
    }),
    buildRound({
      round: 4,
      raceName: 'Chinese Grand Prix',
      country: 'China',
      date: '2024-04-21',
      qualifyingOrder: round4Qualifying,
      q2Eliminated: ['TSU', 'ALB', 'RIC', 'STR', 'HUL'],
      q1Eliminated: ['BOT', 'MAG', 'OCO', 'GAS', 'ZHO', 'SAR'],
      raceGrid: round4Qualifying,
      raceFinish: [
        'VER', 'NOR', 'LEC', 'PIA', 'PER', 'ALO', 'RUS', 'HAM', 'SAI', 'TSU',
        'ALB', 'RIC', 'STR', 'HUL', 'BOT', 'MAG', 'OCO', 'GAS', 'ZHO', 'SAR',
      ],
      raceFastestLapDriver: 'VER',
      sprintGrid: [
        'NOR', 'HAM', 'ALO', 'VER', 'SAI', 'PER', 'LEC', 'PIA', 'RUS', 'TSU',
        'RIC', 'STR', 'ALB', 'HUL', 'MAG', 'BOT', 'OCO', 'GAS', 'ZHO', 'SAR',
      ],
      sprintFinish: [
        'VER', 'HAM', 'PER', 'NOR', 'LEC', 'SAI', 'PIA', 'RUS', 'ALO', 'TSU',
        'RIC', 'STR', 'ALB', 'HUL', 'MAG', 'BOT', 'OCO', 'GAS', 'ZHO', 'SAR',
      ],
      sprintFastestLapDriver: 'VER',
      pitStops: [
        ['McLaren', 20.91],
        ['Red Bull Racing', 21.09],
        ['Ferrari', 21.33],
        ['Mercedes', 21.58],
        ['Aston Martin', 21.96],
        ['RB', 22.14],
        ['Williams', 22.40],
        ['Haas F1 Team', 22.68],
        ['Alpine', 22.87],
        ['Stake F1 Team Kick Sauber', 23.14],
      ],
    }),
  ],
}
