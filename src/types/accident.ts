/** tiles/points/{key}.json — everything needed to render/cluster/color the map and filter by
 * state/year, for one spatial tile. Kept lean on purpose: fetched eagerly per visible tile,
 * tiles/details/{key}.json is not. */
export interface AccidentPoint {
  id: string
  latitude: number
  longitude: number
  state: string
  year: number
  fatalities?: number
}

/** Must match CELL_SIZE_DEGREES in ingestion/src/tiling.ts — used to compute which tile a
 * point/click belongs to without needing a lookup table. */
export const TILE_CELL_SIZE_DEGREES = 5

export function tileKeyFor(latitude: number, longitude: number): string {
  const latIdx = Math.floor(latitude / TILE_CELL_SIZE_DEGREES)
  const lonIdx = Math.floor(longitude / TILE_CELL_SIZE_DEGREES)
  return `${latIdx}_${lonIdx}`
}

/** tiles/manifest.json — bounding box and point count for every tile that has data, so the
 * client knows which tiles exist (and can skip fetching empty-ocean cells) without guessing. */
export interface TileManifestEntry {
  key: string
  latMin: number
  lonMin: number
  latMax: number
  lonMax: number
  count: number
}

/** year-counts-by-state.json — state -> year -> count, covering every accident regardless of
 * which map tiles are currently loaded. Used to show a stable "N results" total for the active
 * filter that doesn't change as the user pans/zooms the globe. */
export type YearCountsByState = Record<string, Record<number, number>>

export type YearFilter = 'all' | '20y' | '5y' | 'lastYear' | 'thisYear'

export const YEAR_FILTER_OPTIONS: { value: YearFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '20y', label: 'Last 20 years' },
  { value: '5y', label: 'Last 5 years' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'thisYear', label: 'This year' },
]

/** tiles/details/{key}.json — keyed by id, one shard per tile, fetched lazily the first time a
 * marker in that tile is clicked. Merge with an AccidentPoint (by id) to get the full record
 * for the detail panel. */
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
