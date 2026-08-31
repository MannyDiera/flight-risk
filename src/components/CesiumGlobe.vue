<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as Cesium from 'cesium'
import type { AccidentPoint, DensityCell } from '@/types/accident'
import { useAccidentsData, type ViewBounds } from '@/composables/useAccidentsData'
import { STATE_BOUNDS } from '@/data/stateBounds'

const props = defineProps<{
  showMarkers: boolean
  showDensity: boolean
}>()

const emit = defineEmits<{
  select: [point: AccidentPoint]
  'zoomed-out-change': [zoomedOut: boolean]
  'zoom-progress': [value: number]
}>()

const { filteredPoints, densityGrid, stateFilter, ensureTilesLoaded } = useAccidentsData()

const container = ref<HTMLDivElement | null>(null)
let viewer: Cesium.Viewer | null = null
let accidentsDataSource: Cesium.CustomDataSource | null = null
let densityDataSource: Cesium.CustomDataSource | null = null
const accidentById = new Map<string, AccidentPoint>()

// Continental US bounding rectangle.
const CONUS_WEST = -125
const CONUS_SOUTH = 24
const CONUS_EAST = -66
const CONUS_NORTH = 50

// Above this camera altitude, individual markers aren't fetched or rendered — only the density
// layer is shown. Keeps rendered/clustered entity counts bounded regardless of how much data
// the active year filter would otherwise match (e.g. "All time" is 39k+ points).
const MARKER_ALTITUDE_THRESHOLD_METERS = 800_000
// Camera altitude at/above which the "zoom in" progress bar reads 0%. Roughly the altitude of the
// default CONUS view, so the bar sits empty at rest and fills as the user zooms toward
// MARKER_ALTITUDE_THRESHOLD_METERS (where it reads 100% and markers begin to load). Interpolated
// in log space (see computeZoomProgress) since zoom is exponential.
const PROGRESS_START_ALTITUDE_METERS = 6_000_000
// Height above the ellipsoid for accident markers — see the comment at their entity definition.
const MARKER_HEIGHT_METERS = 1_000
// Extra margin (degrees) around the current view when deciding which tiles/points to load and
// render, so markers don't visibly pop in right at the viewport edge while panning.
const VIEW_BUFFER_DEGREES = 2

const DENSITY_COLORS: Record<DensityCell['tier'], Cesium.Color> = {
  red: Cesium.Color.fromCssColorString('#e5484d').withAlpha(0.45),
  orange: Cesium.Color.fromCssColorString('#f2872c').withAlpha(0.4),
  yellow: Cesium.Color.fromCssColorString('#e8c547').withAlpha(0.35),
}

const CLUSTER_ICON_SIZE = 48 // logical (CSS) pixels — see explicit billboard width/height below
const clusterIconCache = new Map<number, string>()

function getClusterIcon(count: number): string {
  const label = count > 999 ? '999+' : String(count)
  const cached = clusterIconCache.get(count)
  if (cached) return cached

  // Draw at devicePixelRatio so the icon stays crisp on retina/high-DPI displays — a canvas
  // backed 1:1 with CSS pixels gets upscaled by the browser/GPU and looks soft. The billboard's
  // width/height are pinned to CLUSTER_ICON_SIZE (see clusterEvent below) so the on-screen size
  // stays the same regardless of the backing resolution.
  const dpr = window.devicePixelRatio || 1
  const size = CLUSTER_ICON_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = size * dpr
  canvas.height = size * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(79, 143, 209, 0.95)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#eef2f7'
  ctx.stroke()

  ctx.fillStyle = '#eef2f7'
  ctx.font = label.length > 3 ? 'bold 13px sans-serif' : 'bold 15px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, size / 2, size / 2 + 1)

  const dataUrl = canvas.toDataURL()
  clusterIconCache.set(count, dataUrl)
  return dataUrl
}

let currentBounds: ViewBounds | null = null

function boundsWithBuffer(rect: Cesium.Rectangle): ViewBounds {
  return {
    west: Cesium.Math.toDegrees(rect.west) - VIEW_BUFFER_DEGREES,
    south: Cesium.Math.toDegrees(rect.south) - VIEW_BUFFER_DEGREES,
    east: Cesium.Math.toDegrees(rect.east) + VIEW_BUFFER_DEGREES,
    north: Cesium.Math.toDegrees(rect.north) + VIEW_BUFFER_DEGREES,
  }
}

function pointInBounds(p: AccidentPoint, bounds: ViewBounds): boolean {
  return p.longitude >= bounds.west && p.longitude <= bounds.east && p.latitude >= bounds.south && p.latitude <= bounds.north
}

function buildAccidentsDataSource(points: AccidentPoint[]): Cesium.CustomDataSource {
  const dataSource = new Cesium.CustomDataSource('accidents')
  accidentById.clear()

  for (const accident of points) {
    accidentById.set(accident.id, accident)
    dataSource.entities.add({
      id: accident.id,
      // Raised above ground level (imperceptible at any zoom level we render at) so markers are
      // unambiguously nearer to the camera than the density overlay and win normal depth
      // testing outright, instead of getting alpha-blended with it and looking dim/muddy.
      position: Cesium.Cartesian3.fromDegrees(accident.longitude, accident.latitude, MARKER_HEIGHT_METERS),
      point: {
        // At pixelSize 6, the antialiased edge and outline consumed most of the circle, leaving
        // little solid fill — read as pale/fuzzy rather than a crisp dot. A larger fill with a
        // thin outline reads solid at typical zoom levels.
        pixelSize: 9,
        color: (accident.fatalities ?? 0) > 0 ? Cesium.Color.fromCssColorString('#e5484d') : Cesium.Color.fromCssColorString('#4f8fd1'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  dataSource.clustering.enabled = true
  dataSource.clustering.pixelRange = 60
  dataSource.clustering.minimumClusterSize = 5
  dataSource.clustering.clusterPoints = true
  dataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
    cluster.point.show = false
    cluster.label.show = false
    cluster.billboard.show = true
    cluster.billboard.image = getClusterIcon(clusteredEntities.length)
    cluster.billboard.width = CLUSTER_ICON_SIZE
    cluster.billboard.height = CLUSTER_ICON_SIZE
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER
    cluster.billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
  })

  return dataSource
}

function buildDensityDataSource(cells: DensityCell[]): Cesium.CustomDataSource {
  const dataSource = new Cesium.CustomDataSource('density')
  for (const cell of cells) {
    dataSource.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(cell.lonMin, cell.latMin, cell.lonMax, cell.latMax),
        material: DENSITY_COLORS[cell.tier],
        outline: false,
        height: 0,
      },
    })
  }
  return dataSource
}

function flyToConus(durationSeconds = 1.2): void {
  if (!viewer) return
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(CONUS_WEST, CONUS_SOUTH, CONUS_EAST, CONUS_NORTH),
    duration: durationSeconds,
  })
}

// Frames the selected state's bounding box with ~12% margin so its border isn't flush with the
// viewport edge. Large states (TX, CA, AK) still end up framed above MARKER_ALTITUDE_THRESHOLD_METERS,
// so the "zoom in" hint stays up until the user zooms further — expected, not a bug.
function flyToStateBounds(code: string, durationSeconds = 1.2): void {
  if (!viewer) return
  const box = STATE_BOUNDS[code]
  if (!box) return
  const [west, south, east, north] = box
  const padX = (east - west) * 0.12
  const padY = (north - south) * 0.12
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(west - padX, south - padY, east + padX, north + padY),
    duration: durationSeconds,
  })
}

// 0 at/above PROGRESS_START_ALTITUDE_METERS, 1 at/below MARKER_ALTITUDE_THRESHOLD_METERS, linear
// in log(height) between them.
function computeZoomProgress(height: number): number {
  const start = Math.log(PROGRESS_START_ALTITUDE_METERS)
  const end = Math.log(MARKER_ALTITUDE_THRESHOLD_METERS)
  const t = (start - Math.log(height)) / (start - end)
  return Math.min(1, Math.max(0, t))
}

let lastEmittedProgress = -1

// Runs every rendered frame (cheap: one height read + a compare). Only emits when the value moves
// enough to matter, so an idle camera produces no events.
function sampleZoomProgress(): void {
  if (!viewer) return
  const p = computeZoomProgress(viewer.camera.positionCartographic.height)
  if (Math.abs(p - lastEmittedProgress) < 0.005) return
  lastEmittedProgress = p
  emit('zoom-progress', p)
}

function raiseMarkersAboveDensity(): void {
  // Without an explicit z-order, whichever data source was (re)added most recently paints on
  // top — keep markers above the density overlay.
  if (viewer && accidentsDataSource) viewer.dataSources.raiseToTop(accidentsDataSource)
}

function rebuildAccidentsDataSource(): void {
  if (!viewer) return
  const bounds = currentBounds
  const visible = bounds ? filteredPoints.value.filter((p) => pointInBounds(p, bounds)) : []

  if (accidentsDataSource) viewer.dataSources.remove(accidentsDataSource, true)
  accidentsDataSource = buildAccidentsDataSource(visible)
  accidentsDataSource.show = props.showMarkers
  viewer.dataSources.add(accidentsDataSource)
  raiseMarkersAboveDensity()
}

let lastZoomedOut: boolean | null = null

function setZoomedOut(zoomedOut: boolean): void {
  if (zoomedOut === lastZoomedOut) return
  lastZoomedOut = zoomedOut
  emit('zoomed-out-change', zoomedOut)
}

async function refreshMarkers(): Promise<void> {
  if (!viewer) return
  const height = viewer.camera.positionCartographic.height

  if (height > MARKER_ALTITUDE_THRESHOLD_METERS) {
    currentBounds = null
    setZoomedOut(true)
    rebuildAccidentsDataSource()
    return
  }
  setZoomedOut(false)

  const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid)
  if (!rect) return
  currentBounds = boundsWithBuffer(rect)

  await ensureTilesLoaded(currentBounds)
  rebuildAccidentsDataSource()
}

function isInteractivePick(picked: unknown): boolean {
  if (!Cesium.defined(picked)) return false
  const id = (picked as { id?: unknown }).id
  if (Array.isArray(id)) return true // cluster
  return id instanceof Cesium.Entity && accidentById.has(id.id)
}

function handleMouseMove(movement: Cesium.ScreenSpaceEventHandler.MotionEvent): void {
  if (!viewer) return
  const picked = viewer.scene.pick(movement.endPosition)
  viewer.canvas.style.cursor = isInteractivePick(picked) ? 'pointer' : 'default'
}

function handleClick(movement: Cesium.ScreenSpaceEventHandler.PositionedEvent): void {
  if (!viewer) return
  const picked = viewer.scene.pick(movement.position)
  if (!Cesium.defined(picked)) return

  if (Array.isArray(picked.id)) {
    // Clicked a cluster — zoom in to frame its members.
    const entities = picked.id as Cesium.Entity[]
    const positions = entities
      .map((e) => e.position?.getValue(viewer!.clock.currentTime))
      .filter((p): p is Cesium.Cartesian3 => !!p)
    if (positions.length > 0) {
      const boundingSphere = Cesium.BoundingSphere.fromPoints(positions)
      viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 0.8,
        offset: new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_TWO, boundingSphere.radius * 3),
      })
    }
    return
  }

  if (picked.id instanceof Cesium.Entity) {
    const accident = accidentById.get(picked.id.id)
    if (accident) emit('select', accident)
  }
}

onMounted(() => {
  if (!container.value) return

  viewer = new Cesium.Viewer(container.value, {
    baseLayerPicker: false,
    baseLayer: new Cesium.ImageryLayer(
      new Cesium.OpenStreetMapImageryProvider({
        credit: '© OpenStreetMap contributors',
      }),
    ),
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    scene3DOnly: true,
  })

  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a0e14')
  flyToConus(0)

  densityDataSource = buildDensityDataSource(densityGrid.value)
  densityDataSource.show = props.showDensity
  viewer.dataSources.add(densityDataSource)

  accidentsDataSource = new Cesium.CustomDataSource('accidents')
  accidentsDataSource.show = props.showMarkers
  viewer.dataSources.add(accidentsDataSource)

  viewer.camera.moveEnd.addEventListener(() => {
    void refreshMarkers()
  })
  viewer.scene.preRender.addEventListener(sampleZoomProgress)
  void refreshMarkers()
  sampleZoomProgress()

  viewer.screenSpaceEventHandler.setInputAction(handleClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  viewer.screenSpaceEventHandler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
})

onBeforeUnmount(() => {
  viewer?.destroy()
  viewer = null
})

// New tiles arriving, or the state/year filter changing, both change what filteredPoints
// contains for the area already in view — re-render against the (unchanged) current bounds.
watch(filteredPoints, () => {
  rebuildAccidentsDataSource()
})

// Picking a state frames it; clearing the filter ("All states") returns to the CONUS view. A
// non-state NTSB region code (no STATE_BOUNDS entry) leaves the camera untouched.
watch(
  () => stateFilter.value,
  (code) => {
    if (code) {
      if (STATE_BOUNDS[code]) flyToStateBounds(code)
    } else {
      flyToConus()
    }
  },
)

watch(
  () => props.showMarkers,
  (show) => {
    if (accidentsDataSource) accidentsDataSource.show = show
  },
)

watch(
  () => props.showDensity,
  (show) => {
    if (densityDataSource) densityDataSource.show = show
  },
)

defineExpose({ resetView: () => flyToConus() })
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
