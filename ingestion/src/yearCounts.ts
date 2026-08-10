import type { Accident } from './types.js'

/** state -> year -> count. Small enough to ship whole and load eagerly, so the frontend can
 * show a total matching the active state/year filter without depending on which map tiles
 * happen to be loaded (which changes as the user pans/zooms). */
export type YearCountsByState = Record<string, Record<number, number>>

export function buildYearCountsByState(accidents: Accident[]): YearCountsByState {
  const counts: YearCountsByState = {}
  for (const a of accidents) {
    const year = new Date(a.date).getUTCFullYear()
    const byYear = (counts[a.state] ??= {})
    byYear[year] = (byYear[year] ?? 0) + 1
  }
  return counts
}
