<script setup lang="ts">
import { ref } from 'vue'
import { YEAR_FILTER_OPTIONS, type YearFilter } from '@/types/accident'

defineProps<{
  showMarkers: boolean
  showDensity: boolean
  states: string[]
  selectedState: string | null
  yearFilter: YearFilter
  resultCount: number
}>()

const emit = defineEmits<{
  'update:showMarkers': [value: boolean]
  'update:showDensity': [value: boolean]
  'update:selectedState': [value: string | null]
  'update:yearFilter': [value: YearFilter]
  reset: []
}>()

const collapsed = ref(false)
</script>

<template>
  <div class="absolute left-4 top-4 z-10">
    <button
      v-if="collapsed"
      type="button"
      class="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-panel/95 text-text-base shadow-xl backdrop-blur transition hover:bg-surface-card"
      aria-label="Show controls"
      @click="collapsed = false"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <path d="M21 3 3 10.5l6.75 2.25L12 21l3-6.75L21 3Z" />
      </svg>
    </button>

    <div
      v-else
      class="max-h-[calc(100vh-2rem)] w-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-surface-panel/95 p-4 shadow-xl backdrop-blur"
    >
      <div class="flex items-start justify-between gap-2">
        <h1 class="text-sm font-semibold text-text-base">Flight Risk</h1>
        <button
          type="button"
          class="rounded-md p-1 text-muted transition hover:bg-surface-card hover:text-text-base"
          aria-label="Hide controls"
          @click="collapsed = true"
        >
          ✕
        </button>
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

      <p class="text-center text-sm font-bold text-text-base">{{ resultCount.toLocaleString() }} results</p>

      <button
        type="button"
        class="w-full rounded-md border border-border bg-surface-card px-3 py-1.5 text-sm text-text-base transition hover:bg-border"
        @click="emit('reset')"
      >
        Reset view
      </button>

      <div class="space-y-3 border-t border-border pt-3 text-xs text-muted">
        <p class="font-medium text-text-base">Legend</p>

        <div class="space-y-1.5">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-text-base/80">Markers</p>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-primary"></span>
            <span>Accident (no fatalities)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-risk-red"></span>
            <span>Accident (fatalities)</span>
          </div>
        </div>

        <div class="space-y-1.5 border-t border-border/60 pt-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-text-base/80">Density layer</p>
          <div class="flex items-center gap-2">
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
      </div>

      <p class="text-[11px] leading-snug text-muted">
        Colors show all-time historical concentration (2000–present), independent of the filters
        above. This is <span class="font-bold text-text-base">not predicted risk</span>.
      </p>

      <a
        href="https://www.ntsb.gov"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-primary-light transition hover:text-text-base"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-3.5 w-3.5 shrink-0">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M4 21V10m4 11V10m4 11V10m4 11V10m4 11V10M2 10l10-6 10 6M3 10h18" />
        </svg>
        <span>Data source: NTSB ↗</span>
      </a>
    </div>
  </div>
</template>
