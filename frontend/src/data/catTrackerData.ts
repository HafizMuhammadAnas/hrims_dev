import logRows from './catTrackerLogData.json'

export type CatTrackerLogRow = {
  id: number
  metric: string
  unit: string
  y15: string
  y16: string
  y17: string
  y18: string
  y19: string
  y20: string
  y21: string
  y22: string
  y23: string
  y24: string
  y25: string
  y26: string
  progress: string
  source: string
}

export const CAT_TRACKER_LOG_DATA = logRows as CatTrackerLogRow[]

export const CAT_TRACKER_LOG_YEARS = [
  '2015',
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  '2025',
  '2026',
] as const

export const CAT_TRACKER_YEAR_KEYS = [
  'y15',
  'y16',
  'y17',
  'y18',
  'y19',
  'y20',
  'y21',
  'y22',
  'y23',
  'y24',
  'y25',
  'y26',
] as const

export const CAT_TRACKER_SUBTABS = [
  'Full Quantitative Log (All 84 Metrics)',
  '5 Flagship Summary Tables & Graphs',
  'Multi-Metric Overview Graph',
] as const

export type CatTrackerSubtab = (typeof CAT_TRACKER_SUBTABS)[number]

export const CAT_TRACKER_TORTURE_PROSECUTIONS = [
  { year: '2019', sent: 19, convictions: 6, acquittals: 4, pending: 9 },
  { year: '2020', sent: 35, convictions: 1, acquittals: 11, pending: 23 },
  { year: '2021', sent: 34, convictions: 8, acquittals: 7, pending: 9 },
  { year: '2022', sent: 19, convictions: 9, acquittals: 6, pending: 4 },
  { year: '2023', sent: 33, convictions: 18, acquittals: 2, pending: 13 },
  { year: '2024', sent: 44, convictions: 15, acquittals: 18, pending: 11 },
  { year: '2025', sent: 11, convictions: 0, acquittals: 3, pending: 8 },
] as const

export const CAT_TRACKER_ENFORCED_DISAPPEARANCES = [
  { year: '2019', received: 800, disposed: 814 },
  { year: '2020', received: 415, disposed: 433 },
  { year: '2021', received: 1450, disposed: 1381 },
  { year: '2022', received: 860, disposed: 1019 },
  { year: '2023', received: 835, disposed: 788 },
  { year: '2024', received: 379, disposed: 427 },
  { year: '2025', received: 140, disposed: 554 },
] as const

export const CAT_TRACKER_CUSTODIAL_DEATHS = [
  { year: '2019', sindhMale: 29, kpMale: 35, punjabTotal: 244 },
  { year: '2020', sindhMale: 45, kpMale: 48, punjabTotal: 287 },
  { year: '2021', sindhMale: 47, kpMale: 49, punjabTotal: 309 },
  { year: '2022', sindhMale: 78, kpMale: 51, punjabTotal: 258 },
  { year: '2023', sindhMale: 89, kpMale: 54, punjabTotal: 268 },
  { year: '2024', sindhMale: 80, kpMale: 52, punjabTotal: 307 },
] as const

export const CAT_TRACKER_PRISON_OCCUPANCY = [
  { province: 'Punjab', capacity: 37217, population: 68204, occupancy: '183%' },
  { province: 'Sindh', capacity: 13538, population: 22721, occupancy: '168%' },
  { province: 'KP', capacity: 13375, population: 13961, occupancy: '104%' },
  { province: 'Balochistan', capacity: 2764, population: 2874, occupancy: '104%' },
  { province: 'National Total', capacity: 66894, population: 103175, occupancy: '154%' },
] as const

export const CAT_TRACKER_GBV = [
  { year: '2022', registered: 2172, convictions: 76 },
  { year: '2023', registered: 2692, convictions: 100 },
  { year: '2024', registered: 2698, convictions: 50 },
  { year: '2025', registered: 2442, convictions: 25 },
] as const

export const CAT_TRACKER_OVERVIEW = [
  { year: '2019', disappearancesReceived: 800, punjabCustodialDeaths: 244, tortureCasesSent: 19, vawRegistered: null },
  { year: '2020', disappearancesReceived: 415, punjabCustodialDeaths: 287, tortureCasesSent: 35, vawRegistered: null },
  { year: '2021', disappearancesReceived: 1450, punjabCustodialDeaths: 309, tortureCasesSent: 34, vawRegistered: null },
  { year: '2022', disappearancesReceived: 860, punjabCustodialDeaths: 258, tortureCasesSent: 19, vawRegistered: 2172 },
  { year: '2023', disappearancesReceived: 835, punjabCustodialDeaths: 268, tortureCasesSent: 33, vawRegistered: 2692 },
  { year: '2024', disappearancesReceived: 379, punjabCustodialDeaths: 307, tortureCasesSent: 44, vawRegistered: 2698 },
  { year: '2025', disappearancesReceived: 140, punjabCustodialDeaths: null, tortureCasesSent: 11, vawRegistered: 2442 },
] as const

export function catTrackerProgressBadgeClass(progress: string): string {
  if (progress.includes('Improving')) return 'cat-tracker-badge cat-tracker-badge--improving'
  if (progress.includes('Worsening') || progress.includes('Declined')) return 'cat-tracker-badge cat-tracker-badge--worsening'
  if (progress.includes('Single')) return 'cat-tracker-badge cat-tracker-badge--single'
  return 'cat-tracker-badge cat-tracker-badge--neutral'
}

export const CAT_TRACKER_PROGRESS_FILTERS = [
  { value: 'ALL', label: 'All Progress Types (84 Metrics)' },
  { value: 'Single data point', label: 'Single Data Point' },
  { value: 'Improving', label: 'Improving' },
  { value: 'Worsening', label: 'Worsening' },
  { value: 'Declined', label: 'Declined' },
  { value: 'Context-dependent', label: 'Context-dependent / Other' },
] as const
