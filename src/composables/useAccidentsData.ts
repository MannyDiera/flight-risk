import { computed, ref } from 'vue'
import type { AccidentDetail, AccidentPoint, DensityCell, YearFilter } from '@/types/accident'

const points = ref<AccidentPoint[]>([])
const densityGrid = ref<DensityCell[]>([])
const detailsById = ref<Record<string, AccidentDetail>>({})

const loading = ref(true) // blocks first render — set false once points+density arrive
const loaded = ref(false)
const error = ref<string | null>(null)

const detailsLoading = ref(false) // does not block render — fetched in the background
const detailsError = ref<string | null>(null)

const stateFilter = ref<string | null>(null)
// Defaults to the narrowest non-trivial range — fewer map entities to build/cluster on first
// load is faster than "all time", since every option is served from the same already-fetched file.
const yearFilter = ref<YearFilter>('5y')
let started = false

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

const availableStates = computed(() => {
  const states = new Set(points.value.map((p) => p.state))
  return [...states].sort()
})

async function loadDetailsInBackground(): Promise<void> {
  detailsLoading.value = true
  try {
    const res = await fetch('/data/accident-details.json')
    if (!res.ok) throw new Error('Failed to load accident details')
    detailsById.value = await res.json()
  } catch (e) {
    detailsError.value = e instanceof Error ? e.message : 'Failed to load accident details'
  } finally {
    detailsLoading.value = false
  }
}

async function load(): Promise<void> {
  if (started) return
  started = true
  loading.value = true
  error.value = null
  try {
    const [pointsRes, densityRes] = await Promise.all([
      fetch('/data/accidents.json'),
      fetch('/data/density-grid.json'),
    ])
    if (!pointsRes.ok || !densityRes.ok) {
      throw new Error('Failed to load accident data')
    }
    points.value = await pointsRes.json()
    densityGrid.value = await densityRes.json()
    loaded.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load accident data'
  } finally {
    loading.value = false
  }

  // Fire-and-forget: the map is already usable at this point, details fill in as they arrive.
  void loadDetailsInBackground()
}

export function useAccidentsData() {
  return {
    points,
    filteredPoints,
    densityGrid,
    detailsById,
    availableStates,
    stateFilter,
    yearFilter,
    loading,
    loaded,
    error,
    detailsLoading,
    detailsError,
    load,
  }
}
