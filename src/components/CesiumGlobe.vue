<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as Cesium from 'cesium'
import type { AccidentPoint, DensityCell } from '@/types/accident'

const props = defineProps<{
  accidents: AccidentPoint[]
  densityGrid: DensityCell[]
  showMarkers: boolean
  showDensity: boolean
}>()

const emit = defineEmits<{
  select: [point: AccidentPoint]
}>()

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

const DENSITY_COLORS: Record<DensityCell['tier'], Cesium.Color> = {
  red: Cesium.Color.fromCssColorString('#e5484d').withAlpha(0.45),
  orange: Cesium.Color.fromCssColorString('#f2872c').withAlpha(0.4),
  yellow: Cesium.Color.fromCssColorString('#e8c547').withAlpha(0.35),
}

const clusterIconCache = new Map<number, string>()

function getClusterIcon(count: number): string {
  const label = count > 999 ? '999+' : String(count)
  const cached = clusterIconCache.get(count)
  if (cached) return cached

  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(79, 143, 209, 0.85)'
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

function buildAccidentsDataSource(accidents: AccidentPoint[]): Cesium.CustomDataSource {
  const dataSource = new Cesium.CustomDataSource('accidents')
  accidentById.clear()

  for (const accident of accidents) {
    accidentById.set(accident.id, accident)
    dataSource.entities.add({
      id: accident.id,
      position: Cesium.Cartesian3.fromDegrees(accident.longitude, accident.latitude),
      point: {
        pixelSize: 6,
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

function raiseMarkersAboveDensity(): void {
  // The density overlay is ground-clamped and translucent; without an explicit z-order,
  // whichever data source was (re)added most recently paints on top, dimming the markers.
  if (viewer && accidentsDataSource) viewer.dataSources.raiseToTop(accidentsDataSource)
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

  accidentsDataSource = buildAccidentsDataSource(props.accidents)
  accidentsDataSource.show = props.showMarkers
  viewer.dataSources.add(accidentsDataSource)

  densityDataSource = buildDensityDataSource(props.densityGrid)
  densityDataSource.show = props.showDensity
  viewer.dataSources.add(densityDataSource)

  raiseMarkersAboveDensity()

  viewer.screenSpaceEventHandler.setInputAction(handleClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  viewer.screenSpaceEventHandler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
})

onBeforeUnmount(() => {
  viewer?.destroy()
  viewer = null
})

watch(
  () => props.accidents,
  (accidents) => {
    if (!viewer || !accidentsDataSource) return
    viewer.dataSources.remove(accidentsDataSource, true)
    accidentsDataSource = buildAccidentsDataSource(accidents)
    accidentsDataSource.show = props.showMarkers
    viewer.dataSources.add(accidentsDataSource)
    raiseMarkersAboveDensity()
  },
)

watch(
  () => props.densityGrid,
  (cells) => {
    if (!viewer || !densityDataSource) return
    viewer.dataSources.remove(densityDataSource, true)
    densityDataSource = buildDensityDataSource(cells)
    densityDataSource.show = props.showDensity
    viewer.dataSources.add(densityDataSource)
    raiseMarkersAboveDensity()
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
