<script setup lang="ts">
import { onMounted, ref } from 'vue'
import CesiumGlobe from '@/components/CesiumGlobe.vue'
import ControlsBar from '@/components/ControlsBar.vue'
import AccidentPanel from '@/components/AccidentPanel.vue'
import { useAccidentsData } from '@/composables/useAccidentsData'
import type { AccidentPoint } from '@/types/accident'

const {
  detailsById,
  availableStates,
  stateFilter,
  yearFilter,
  filteredCount,
  loading,
  error,
  load,
  ensureDetail,
} = useAccidentsData()

const showMarkers = ref(true)
const showDensity = ref(true)
const selectedPoint = ref<AccidentPoint | null>(null)
const globeRef = ref<InstanceType<typeof CesiumGlobe> | null>(null)
const zoomedOut = ref(true)
// 0 → 1, how close the camera is to the altitude where individual markers appear (and this hint
// disappears). Drives the progress bar under the hint.
const zoomProgress = ref(0)

onMounted(load)

function selectPoint(point: AccidentPoint): void {
  selectedPoint.value = point
  void ensureDetail(point.id, point.latitude, point.longitude)
}
</script>

<template>
  <div class="relative h-full w-full overflow-hidden">
    <CesiumGlobe
      v-if="!loading && !error"
      ref="globeRef"
      :show-markers="showMarkers"
      :show-density="showDensity"
      @select="selectPoint"
      @zoomed-out-change="zoomedOut = $event"
      @zoom-progress="zoomProgress = $event"
    />

    <transition name="hint-fade">
      <div
        v-if="!loading && !error && zoomedOut"
        class="pointer-events-none absolute left-1/2 top-4 z-10 w-[min(90vw,26rem)] -translate-x-1/2 rounded-lg border border-border bg-surface-panel/95 px-4 py-2 text-sm text-text-base shadow-xl backdrop-blur"
      >
        <p class="text-center">Zoom in to see individual accidents — colors show all-time historical concentration</p>
        <div
          class="mt-2 h-1 w-full overflow-hidden rounded-full bg-border/60"
          role="progressbar"
          :aria-valuenow="Math.round(zoomProgress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Zoom progress toward showing individual accidents"
        >
          <div
            class="mx-auto h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
            :style="{ width: `${zoomProgress * 100}%` }"
          />
        </div>
      </div>
    </transition>

    <div v-if="loading" class="flex h-full w-full items-center justify-center">
      <p class="text-muted">Loading accident data…</p>
    </div>

    <div v-else-if="error" class="flex h-full w-full items-center justify-center">
      <p class="text-risk-red">{{ error }}</p>
    </div>

    <template v-else>
      <ControlsBar
        :show-markers="showMarkers"
        :show-density="showDensity"
        :states="availableStates"
        :selected-state="stateFilter"
        :year-filter="yearFilter"
        :result-count="filteredCount"
        @update:show-markers="showMarkers = $event"
        @update:show-density="showDensity = $event"
        @update:selected-state="stateFilter = $event"
        @update:year-filter="yearFilter = $event"
        @reset="globeRef?.resetView()"
      />

      <AccidentPanel
        :point="selectedPoint"
        :detail="selectedPoint ? detailsById[selectedPoint.id] : undefined"
        @close="selectedPoint = null"
      />
    </template>
  </div>
</template>

<style scoped>
.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: opacity 0.3s ease;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
}
</style>
