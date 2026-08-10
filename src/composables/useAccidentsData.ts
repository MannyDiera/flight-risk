import { computed, ref } from 'vue'
import type { AccidentDetail, AccidentPoint, DensityCell, TileManifestEntry, YearCountsByState, YearFilter } from '@/types/accident'
import { tileKeyFor } from '@/types/accident'

export interface ViewBounds {
  west: number
  south: number
  east: number
  north: number
}

const manifest = ref<TileManifestEntry[]>([])
const availableStates = ref<string[]>([])
const points = ref<AccidentPoint[]>([])
const densityGrid = ref<DensityCell[]>([])
const detailsById = ref<Record<string, AccidentDetail>>({})
const yearCountsByState = ref<YearCountsByState>({})

const loading = ref(true) // blocks first render — set false once manifest/states/density arrive
const loaded = ref(false)
const error = ref<string | null>(null)

const detailsLoading = ref(false)

const stateFilter = ref<string | null>(null)
const yearFilter = ref<YearFilter>('5y')
let started = false

const loadedPointTiles = new Set<string>()
const pendingPointTiles = new Map<string, Promise<void>>()
const loadedDetailTiles = new Set<string>()
const pendingDetailTiles = new Map<string, Promise<void>>()

function matchesYearFilter(year: number, filter: YearFilter): boolean {
  const currentYear = new Date().getUTCFullYear()
  switch (filter) {
    case 'all':
      return true
    case '20y':
      return year > currentYear - 20
    case '5y':
      return year > currentYear - 5
    case 'lastYear':
      return year === currentYear - 1
    case 'thisYear':
      return year === currentYear
  }
}

const filteredPoints = computed(() => {
  return points.value.filter((p) => {
    if (stateFilter.value && p.state !== stateFilter.value) return false
    if (!matchesYearFilter(p.year, yearFilter.value)) return false
    return true
  })
})

/** Total accidents matching the active state/year filter across the whole dataset — independent
 * of which map tiles happen to be loaded, so it doesn't fluctuate as the user pans/zooms. */
const filteredCount = computed(() => {
  const states = stateFilter.value ? [stateFilter.value] : Object.keys(yearCountsByState.value)
  let total = 0
  for (const state of states) {
    const byYear = yearCountsByState.value[state]
    if (!byYear) continue
    for (const [yearStr, count] of Object.entries(byYear)) {
      if (matchesYearFilter(Number(yearStr), yearFilter.value)) total += count
    }
  }
  return total
})

function tileIntersectsBounds(tile: TileManifestEntry, bounds: ViewBounds): boolean {
  return tile.lonMin < bounds.east && tile.lonMax > bounds.west && tile.latMin < bounds.north && tile.latMax > bounds.south
}

/** Fetches point tiles intersecting the given lat/lon bounds (degrees) that haven't been
 * loaded yet. Safe to call repeatedly — already-loaded/in-flight tiles are skipped. */
async function ensureTilesLoaded(bounds: ViewBounds): Promise<void> {
  if (bounds.west > bounds.east) return // antimeridian-spanning views only occur at very low zoom, where tiles aren't fetched anyway

  const toFetch = manifest.value.filter((t) => !loadedPointTiles.has(t.key) && tileIntersectsBounds(t, bounds))
  if (toFetch.length === 0) return

  await Promise.all(
    toFetch.map((tile) => {
      const existing = pendingPointTiles.get(tile.key)
      if (existing) return existing

      const promise = (async () => {
        try {
          const res = await fetch(`/data/tiles/points/${tile.key}.json`)
          if (!res.ok) return
          const tilePoints = (await res.json()) as AccidentPoint[]
          points.value = [...points.value, ...tilePoints]
          loadedPointTiles.add(tile.key)
        } finally {
          pendingPointTiles.delete(tile.key)
        }
      })()

      pendingPointTiles.set(tile.key, promise)
      return promise
    }),
  )
}

/** Lazily fetches the detail shard for the tile containing (latitude, longitude), merging it
 * into detailsById. A single shard covers every accident in that tile, so repeat clicks within
 * the same tile are free after the first fetch. */
async function ensureDetail(id: string, latitude: number, longitude: number): Promise<void> {
  if (detailsById.value[id]) return

  const key = tileKeyFor(latitude, longitude)
  if (loadedDetailTiles.has(key)) return

  const existing = pendingDetailTiles.get(key)
  if (existing) return existing

  detailsLoading.value = true
  const promise = (async () => {
    try {
      const res = await fetch(`/data/tiles/details/${key}.json`)
      if (!res.ok) return
      const shard = (await res.json()) as Record<string, AccidentDetail>
      detailsById.value = { ...detailsById.value, ...shard }
      loadedDetailTiles.add(key)
    } finally {
      pendingDetailTiles.delete(key)
      detailsLoading.value = false
    }
  })()

  pendingDetailTiles.set(key, promise)
  return promise
}

async function load(): Promise<void> {
  if (started) return
  started = true
  loading.value = true
  error.value = null
  try {
    const [manifestRes, statesRes, densityRes, yearCountsRes] = await Promise.all([
      fetch('/data/tiles/manifest.json'),
      fetch('/data/states.json'),
      fetch('/data/density-grid.json'),
      fetch('/data/year-counts-by-state.json'),
    ])
    if (!manifestRes.ok || !statesRes.ok || !densityRes.ok || !yearCountsRes.ok) {
      throw new Error('Failed to load accident data')
    }
    manifest.value = await manifestRes.json()
    availableStates.value = await statesRes.json()
    densityGrid.value = await densityRes.json()
    yearCountsByState.value = await yearCountsRes.json()
    loaded.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load accident data'
  } finally {
    loading.value = false
  }
}

export function useAccidentsData() {
  return {
    points,
    filteredPoints,
    filteredCount,
    densityGrid,
    detailsById,
    availableStates,
    stateFilter,
    yearFilter,
    loading,
    loaded,
    error,
    detailsLoading,
    load,
    ensureTilesLoaded,
    ensureDetail,
  }
}
