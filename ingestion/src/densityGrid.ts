import type { Accident } from './types.js'

const CELL_SIZE_DEGREES = 0.5

export type DensityTier = 'red' | 'orange' | 'yellow'

export interface DensityCell {
  latMin: number
  lonMin: number
  latMax: number
  lonMax: number
  count: number
  tier: DensityTier
}

/**
 * Simple geographic density grid — NOT a statistical risk model. Bucket accidents into
 * fixed-size lat/lon cells, count per cell, and classify by count quantile among cells
 * that have at least one accident. This represents HISTORICAL ACCIDENT CONCENTRATION only.
 */
export function buildDensityGrid(accidents: Accident[]): DensityCell[] {
  const counts = new Map<string, number>()

  for (const a of accidents) {
    const latIdx = Math.floor(a.latitude / CELL_SIZE_DEGREES)
    const lonIdx = Math.floor(a.longitude / CELL_SIZE_DEGREES)
    const key = `${latIdx}_${lonIdx}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const sortedCounts = [...counts.values()].sort((a, b) => a - b)
  const quantile = (p: number): number => {
    const idx = Math.min(sortedCounts.length - 1, Math.floor(p * sortedCounts.length))
    return sortedCounts[idx]
  }

  const redThreshold = quantile(0.9)
  const orangeThreshold = quantile(0.7)
  const yellowThreshold = quantile(0.4)

  const cells: DensityCell[] = []
  for (const [key, count] of counts) {
    let tier: DensityTier
    if (count >= redThreshold) tier = 'red'
    else if (count >= orangeThreshold) tier = 'orange'
    else if (count >= yellowThreshold) tier = 'yellow'
    else continue // below threshold — no color, omit from output

    const [latIdxStr, lonIdxStr] = key.split('_')
    const latIdx = Number(latIdxStr)
    const lonIdx = Number(lonIdxStr)

    cells.push({
      latMin: latIdx * CELL_SIZE_DEGREES,
      lonMin: lonIdx * CELL_SIZE_DEGREES,
      latMax: (latIdx + 1) * CELL_SIZE_DEGREES,
      lonMax: (lonIdx + 1) * CELL_SIZE_DEGREES,
      count,
      tier,
    })
  }

  return cells
}
