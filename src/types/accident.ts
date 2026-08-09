/** accidents.json — everything needed to render/cluster/color the map and filter by state/year.
 * Kept lean on purpose: this file blocks first render, accident-details.json does not. */
export interface AccidentPoint {
  id: string
  latitude: number
  longitude: number
  state: string
  year: number
  fatalities?: number
}

export type YearFilter = 'all' | '20y' | '5y' | 'lastYear' | 'thisYear'

export const YEAR_FILTER_OPTIONS: { value: YearFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '20y', label: 'Last 20 years' },
  { value: '5y', label: 'Last 5 years' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'thisYear', label: 'This year' },
]

/** accident-details.json — keyed by id, fetched in the background after the map is already
 * showing. Merge with an AccidentPoint (by id) to get the full record for the detail panel. */
export interface AccidentDetail {
  date: string
  location: string
  aircraftMake?: string
  aircraftModel?: string
  registration?: string
  injurySummary?: string
  accidentType?: string
  summary?: string
  sourceUrl: string
}

export type DensityTier = 'red' | 'orange' | 'yellow'

export interface DensityCell {
  latMin: number
  lonMin: number
  latMax: number
  lonMax: number
  count: number
  tier: DensityTier
}
