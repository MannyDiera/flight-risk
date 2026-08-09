<script setup lang="ts">
import { onMounted, ref } from 'vue'
import CesiumGlobe from '@/components/CesiumGlobe.vue'
import ControlsBar from '@/components/ControlsBar.vue'
import AccidentPanel from '@/components/AccidentPanel.vue'
import { useAccidentsData } from '@/composables/useAccidentsData'
import type { AccidentPoint } from '@/types/accident'

const {
  filteredPoints,
  densityGrid,
  detailsById,
  availableStates,
  stateFilter,
  yearFilter,
  loading,
  error,
  load,
} = useAccidentsData()

const showMarkers = ref(true)
const showDensity = ref(true)
const selectedPoint = ref<AccidentPoint | null>(null)
const globeRef = ref<InstanceType<typeof CesiumGlobe> | null>(null)

onMounted(load)
</script>

<template>
  <div class="relative h-full w-full overflow-hidden">
    <CesiumGlobe
      v-if="!loading && !error"
      ref="globeRef"
      :accidents="filteredPoints"
      :density-grid="densityGrid"
      :show-markers="showMarkers"
      :show-density="showDensity"
      @select="(point) => (selectedPoint = point)"
    />

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
        :accident-count="filteredPoints.length"
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
