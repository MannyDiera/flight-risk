import type { Accident, AccidentDetail, AccidentPoint } from './types.js'

/** Must match TILE_CELL_SIZE_DEGREES in src/types/accident.ts — the frontend computes a
 * point's tile key from its lat/lon using the same grid to know which detail shard to fetch. */
export const CELL_SIZE_DEGREES = 5

export interface TileManifestEntry {
  key: string
  latMin: number
  lonMin: number
  latMax: number
  lonMax: number
  count: number
}

export interface TileBuildResult {
  pointsByTile: Map<string, AccidentPoint[]>
  detailsByTile: Map<string, Record<string, AccidentDetail>>
  manifest: TileManifestEntry[]
  states: string[]
}

export function tileKeyFor(latitude: number, longitude: number): string {
  const latIdx = Math.floor(latitude / CELL_SIZE_DEGREES)
  const lonIdx = Math.floor(longitude / CELL_SIZE_DEGREES)
  return `${latIdx}_${lonIdx}`
}

/** Buckets accidents into a fixed-size lat/lon grid so the browser only ever fetches the
 * points/details for tiles intersecting whatever's currently in view, instead of every
 * accident on every visit. */
export function buildTiles(accidents: Accident[]): TileBuildResult {
  const pointsByTile = new Map<string, AccidentPoint[]>()
  const detailsByTile = new Map<string, Record<string, AccidentDetail>>()
  const states = new Set<string>()

  for (const a of accidents) {
    states.add(a.state)
    const key = tileKeyFor(a.latitude, a.longitude)

    const point: AccidentPoint = {
      id: a.id,
      latitude: a.latitude,
      longitude: a.longitude,
      state: a.state,
      year: new Date(a.date).getUTCFullYear(),
      fatalities: a.fatalities,
    }
    const points = pointsByTile.get(key)
    if (points) points.push(point)
    else pointsByTile.set(key, [point])

    const detail: AccidentDetail = {
      date: a.date,
      location: a.location,
      aircraftMake: a.aircraftMake,
      aircraftModel: a.aircraftModel,
      registration: a.registration,
      injurySummary: a.injurySummary,
      accidentType: a.accidentType,
      summary: a.summary,
      sourceUrl: a.sourceUrl,
    }
    let details = detailsByTile.get(key)
    if (!details) {
      details = {}
      detailsByTile.set(key, details)
    }
    details[a.id] = detail
  }

  const manifest: TileManifestEntry[] = [...pointsByTile.entries()]
    .map(([key, points]) => {
      const [latIdxStr, lonIdxStr] = key.split('_')
      const latIdx = Number(latIdxStr)
      const lonIdx = Number(lonIdxStr)
      return {
        key,
        latMin: latIdx * CELL_SIZE_DEGREES,
        lonMin: lonIdx * CELL_SIZE_DEGREES,
        latMax: (latIdx + 1) * CELL_SIZE_DEGREES,
        lonMax: (lonIdx + 1) * CELL_SIZE_DEGREES,
        count: points.length,
      }
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  return { pointsByTile, detailsByTile, manifest, states: [...states].sort() }
}
