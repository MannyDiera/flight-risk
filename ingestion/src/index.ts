import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchYear } from './fetchCarol.js'
import { normalizeRecord } from './normalize.js'
import { buildDensityGrid } from './densityGrid.js'
import type { Accident, AccidentDetail, AccidentPoint } from './types.js'

const START_YEAR = 2000
const END_YEAR = new Date().getUTCFullYear()
const REQUEST_DELAY_MS = 500

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(__dirname, '../../public/data')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const accidents = new Map<string, Accident>()
  let totalRaw = 0
  let droppedNoCoords = 0

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    process.stdout.write(`Fetching ${year}... `)
    const raw = await fetchYear(year)
    totalRaw += raw.length

    let normalizedThisYear = 0
    for (const rec of raw) {
      const accident = normalizeRecord(rec)
      if (!accident) {
        droppedNoCoords++
        continue
      }
      accidents.set(accident.id, accident)
      normalizedThisYear++
    }

    console.log(`${raw.length} records, ${normalizedThisYear} normalized`)
    await sleep(REQUEST_DELAY_MS)
  }

  const accidentList = [...accidents.values()].sort((a, b) => a.date.localeCompare(b.date))
  const densityGrid = buildDensityGrid(accidentList)

  // Split: the browser only needs point/color/filter fields to render the map. Everything else
  // (narrative, aircraft, registration, source link) is fetched lazily, in the background, so
  // first paint isn't blocked on a ~20MB download.
  const points: AccidentPoint[] = accidentList.map((a) => ({
    id: a.id,
    latitude: a.latitude,
    longitude: a.longitude,
    state: a.state,
    year: new Date(a.date).getUTCFullYear(),
    fatalities: a.fatalities,
  }))

  const detailsById: Record<string, AccidentDetail> = {}
  for (const a of accidentList) {
    detailsById[a.id] = {
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
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(path.join(OUTPUT_DIR, 'accidents.json'), JSON.stringify(points))
  await writeFile(path.join(OUTPUT_DIR, 'accident-details.json'), JSON.stringify(detailsById))
  await writeFile(path.join(OUTPUT_DIR, 'density-grid.json'), JSON.stringify(densityGrid))

  const pointsSize = Buffer.byteLength(JSON.stringify(points))
  const detailsSize = Buffer.byteLength(JSON.stringify(detailsById))

  console.log('\n--- Summary ---')
  console.log(`Years: ${START_YEAR}-${END_YEAR}`)
  console.log(`Raw records fetched: ${totalRaw}`)
  console.log(`Normalized (has coordinates + date): ${accidentList.length}`)
  console.log(`Dropped (missing coordinates/date): ${droppedNoCoords}`)
  console.log(`Coordinate coverage: ${((accidentList.length / totalRaw) * 100).toFixed(1)}%`)
  console.log(`Density grid cells: ${densityGrid.length}`)
  console.log(`accidents.json (map-critical, blocks first render): ${(pointsSize / 1024 / 1024).toFixed(1)} MB`)
  console.log(`accident-details.json (background-loaded): ${(detailsSize / 1024 / 1024).toFixed(1)} MB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
