<script setup>
import { computed } from 'vue'

const props = defineProps({
  problem: {
    type: Object,
    required: true,
  },
  typeColorMode: {
    type: String,
    default: 'by-type',
  },
})

const statsItems = computed(() => [
  { label: '浏览', value: props.problem.stats?.views || '—' },
  { label: '通过', value: props.problem.stats?.passes || '—' },
  { label: '下载', value: props.problem.stats?.downloads || '—' },
  { label: '收藏', value: props.problem.stats?.favorites || '—' },
])
</script>

<template>
  <header
    class="question-header"
    :data-question-type="problem.type"
    :data-type-color-mode="typeColorMode"
  >
    <div class="question-header-title">
      <p class="question-header-meta">
        <span class="question-header-id">{{ problem.id }}</span>
        <span class="question-header-divider" aria-hidden="true"></span>
        <span class="question-header-type">{{ problem.typeLabel }}</span>
      </p>

      <h1 id="question-page-title">{{ problem.title }}</h1>
    </div>

    <div class="question-header-stats" aria-label="题目统计">
      <div v-for="item in statsItems" :key="item.label" class="question-header-stats-item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div class="question-header-actions">
      <slot name="actions"></slot>
    </div>
  </header>
</template>
