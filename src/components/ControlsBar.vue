<script setup lang="ts">
import { YEAR_FILTER_OPTIONS, type YearFilter } from '@/types/accident'

defineProps<{
  showMarkers: boolean
  showDensity: boolean
  states: string[]
  selectedState: string | null
  yearFilter: YearFilter
  accidentCount: number
}>()

const emit = defineEmits<{
  'update:showMarkers': [value: boolean]
  'update:showDensity': [value: boolean]
  'update:selectedState': [value: string | null]
  'update:yearFilter': [value: YearFilter]
  reset: []
}>()
</script>

<template>
  <div class="absolute left-4 top-4 z-10 w-64 space-y-3 rounded-lg border border-border bg-surface-panel/95 p-4 shadow-xl backdrop-blur">
    <div>
      <h1 class="text-sm font-semibold text-text-base">Flight Risk</h1>
      <p class="text-xs text-muted">{{ accidentCount.toLocaleString() }} accidents shown</p>
    </div>

    <label class="flex items-center justify-between text-sm text-text-base">
      <span>Accident markers</span>
      <input
        type="checkbox"
        :checked="showMarkers"
        class="accent-primary"
        @change="emit('update:showMarkers', ($event.target as HTMLInputElement).checked)"
      />
    </label>

    <label class="flex items-center justify-between text-sm text-text-base">
      <span>Density layer</span>
      <input
        type="checkbox"
        :checked="showDensity"
        class="accent-primary"
        @change="emit('update:showDensity', ($event.target as HTMLInputElement).checked)"
      />
    </label>

    <div>
      <label class="mb-1 block text-xs text-muted" for="state-filter">Filter by state</label>
      <select
        id="state-filter"
        class="w-full rounded-md border border-border bg-surface-card px-2 py-1.5 text-sm text-text-base"
        :value="selectedState ?? ''"
        @change="emit('update:selectedState', ($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">All states</option>
        <option v-for="state in states" :key="state" :value="state">{{ state }}</option>
      </select>
    </div>

    <div>
      <label class="mb-1 block text-xs text-muted" for="year-filter">Time range</label>
      <select
        id="year-filter"
        class="w-full rounded-md border border-border bg-surface-card px-2 py-1.5 text-sm text-text-base"
        :value="yearFilter"
        @change="emit('update:yearFilter', ($event.target as HTMLSelectElement).value as YearFilter)"
      >
        <option v-for="option in YEAR_FILTER_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <button
      type="button"
      class="w-full rounded-md border border-border bg-surface-card px-3 py-1.5 text-sm text-text-base transition hover:bg-border"
      @click="emit('reset')"
    >
      Reset view
    </button>

    <div class="space-y-1.5 border-t border-border pt-3 text-xs text-muted">
      <p class="font-medium text-text-base">Legend</p>

      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full bg-primary"></span>
        <span>Accident (no fatalities)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full bg-risk-red"></span>
        <span>Accident (fatalities)</span>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <span class="h-2.5 w-2.5 rounded-sm bg-risk-red"></span>
        <span>Highest concentration</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-sm bg-risk-orange"></span>
        <span>Medium concentration</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-sm bg-risk-yellow"></span>
        <span>Lower concentration</span>
      </div>
    </div>

    <p class="text-[11px] leading-snug text-muted">
      Colors show historical accident concentration only — not predicted risk.
    </p>
  </div>
</template>
