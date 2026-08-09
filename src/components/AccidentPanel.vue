<script setup lang="ts">
import { computed } from 'vue'
import type { AccidentDetail, AccidentPoint } from '@/types/accident'

const props = defineProps<{
  point: AccidentPoint | null
  detail: AccidentDetail | undefined
}>()

defineEmits<{
  close: []
}>()

const formattedDate = computed(() => {
  if (!props.detail) return ''
  const date = new Date(props.detail.date)
  if (Number.isNaN(date.getTime())) return props.detail.date
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date)
})

const aircraft = computed(() => {
  if (!props.detail) return null
  const parts = [props.detail.aircraftMake, props.detail.aircraftModel].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
})
</script>

<template>
  <Transition name="slide">
    <aside
      v-if="point"
      class="absolute right-4 top-4 z-10 w-[min(360px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-border bg-surface-panel/95 p-5 shadow-xl backdrop-blur"
    >
      <div class="flex items-start justify-between gap-3">
        <div v-if="detail">
          <p class="text-xs uppercase tracking-wide text-muted">{{ detail.accidentType || 'Accident' }}</p>
          <h2 class="text-lg font-semibold text-text-base">{{ formattedDate }}</h2>
        </div>
        <p v-else class="text-sm text-muted">Loading details…</p>
        <button
          type="button"
          class="rounded-md p-1 text-muted transition hover:bg-surface-card hover:text-text-base"
          aria-label="Close"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <dl v-if="detail" class="mt-4 space-y-3 text-sm">
        <div>
          <dt class="text-muted">Location</dt>
          <dd class="text-text-base">{{ detail.location }}, {{ point.state }}</dd>
        </div>

        <div v-if="aircraft">
          <dt class="text-muted">Aircraft</dt>
          <dd class="text-text-base">{{ aircraft }}</dd>
        </div>

        <div v-if="detail.registration">
          <dt class="text-muted">Registration</dt>
          <dd class="text-text-base">{{ detail.registration }}</dd>
        </div>

        <div v-if="detail.injurySummary">
          <dt class="text-muted">Injuries</dt>
          <dd class="text-text-base">{{ detail.injurySummary }}</dd>
        </div>

        <div v-if="detail.summary">
          <dt class="text-muted">Summary</dt>
          <dd class="text-text-base leading-relaxed">{{ detail.summary }}</dd>
        </div>
      </dl>

      <a
        v-if="detail"
        :href="detail.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-surface transition hover:bg-primary-light"
      >
        View NTSB Source ↗
      </a>
    </aside>
  </Transition>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(12px);
  opacity: 0;
}
</style>
