import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchYear } from './fetchCarol.js'
import { normalizeRecord } from './normalize.js'
import { buildDensityGrid } from './densityGrid.js'
import { buildTiles } from './tiling.js'
import { buildYearCountsByState } from './yearCounts.js'
import type { Accident } from './types.js'

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

  // Spatially tiled: the browser only fetches points/details for tiles intersecting whatever's
  // currently in the camera's view, instead of every accident on every visit. See tiling.ts.
  const { pointsByTile, detailsByTile, manifest, states } = buildTiles(accidentList)

  const pointsDir = path.join(OUTPUT_DIR, 'tiles', 'points')
  const detailsDir = path.join(OUTPUT_DIR, 'tiles', 'details')
  await rm(path.join(OUTPUT_DIR, 'tiles'), { recursive: true, force: true })
  await mkdir(pointsDir, { recursive: true })
  await mkdir(detailsDir, { recursive: true })

  await Promise.all([
    ...[...pointsByTile.entries()].map(([key, points]) =>
      writeFile(path.join(pointsDir, `${key}.json`), JSON.stringify(points)),
    ),
    ...[...detailsByTile.entries()].map(([key, details]) =>
      writeFile(path.join(detailsDir, `${key}.json`), JSON.stringify(details)),
    ),
  ])

  const yearCountsByState = buildYearCountsByState(accidentList)

  await writeFile(path.join(OUTPUT_DIR, 'tiles', 'manifest.json'), JSON.stringify(manifest))
  await writeFile(path.join(OUTPUT_DIR, 'states.json'), JSON.stringify(states))
  await writeFile(path.join(OUTPUT_DIR, 'density-grid.json'), JSON.stringify(densityGrid))
  await writeFile(path.join(OUTPUT_DIR, 'year-counts-by-state.json'), JSON.stringify(yearCountsByState))

  const totalPointsSize = [...pointsByTile.values()].reduce((n, p) => n + Buffer.byteLength(JSON.stringify(p)), 0)
  const totalDetailsSize = [...detailsByTile.values()].reduce((n, d) => n + Buffer.byteLength(JSON.stringify(d)), 0)
  const tileSizes = [...pointsByTile.values()].map((p) => p.length).sort((a, b) => a - b)

  console.log('\n--- Summary ---')
  console.log(`Years: ${START_YEAR}-${END_YEAR}`)
  console.log(`Raw records fetched: ${totalRaw}`)
  console.log(`Normalized (has coordinates + date): ${accidentList.length}`)
  console.log(`Dropped (missing coordinates/date): ${droppedNoCoords}`)
  console.log(`Coordinate coverage: ${((accidentList.length / totalRaw) * 100).toFixed(1)}%`)
  console.log(`Density grid cells: ${densityGrid.length}`)
  console.log(`States: ${states.length}`)
  console.log(`Tiles: ${manifest.length} (median ${tileSizes[Math.floor(tileSizes.length / 2)]} pts, max ${tileSizes[tileSizes.length - 1]} pts)`)
  console.log(`tiles/points total: ${(totalPointsSize / 1024 / 1024).toFixed(1)} MB across ${manifest.length} files`)
  console.log(`tiles/details total: ${(totalDetailsSize / 1024 / 1024).toFixed(1)} MB across ${manifest.length} files`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
