<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const normalizedItems = computed(() =>
  props.items.map((item, index) => {
    const numericValue = Number(item.value)
    const hasValue = item.value !== null && item.value !== '' && Number.isFinite(numericValue)

    return {
      color: String(item.color || 'blue'),
      key: String(item.key || index),
      label: String(item.label || '未命名题型'),
      value: hasValue ? Math.max(0, numericValue) : null,
    }
  }),
)
const hasTypeData = computed(() => normalizedItems.value.some((item) => item.value !== null))
const totalValue = computed(() =>
  hasTypeData.value
    ? normalizedItems.value.reduce((total, item) => total + (item.value ?? 0), 0)
    : null,
)
const chartItems = computed(() => [
  {
    color: 'total',
    key: 'total',
    label: '总计',
    value: totalValue.value,
  },
  ...normalizedItems.value,
])
const maximumValue = computed(() => totalValue.value ?? 0)
const chartAriaLabel = computed(() => {
  if (!hasTypeData.value) {
    return '题型统计数据尚未接入'
  }

  const itemSummary = normalizedItems.value
    .map((item) => `${item.label}${item.value ?? 0}道`)
    .join('，')
  return `已完成题目共${totalValue.value}道；${itemSummary}`
})

function getBarHeight(value) {
  if (value === null || maximumValue.value <= 0) {
    return '0%'
  }

  return `${Math.max(3, Math.round((value / maximumValue.value) * 100))}%`
}
</script>

<template>
  <section class="account-profile-chart-card account-profile-type-card">
    <header class="account-profile-chart-heading">
      <div>
        <h2>题型分布</h2>
        <p>按已完成题目的题型汇总</p>
      </div>
      <span>{{ hasTypeData ? '已完成题目' : '数据待接入' }}</span>
    </header>

    <div class="account-profile-type-chart" :aria-label="chartAriaLabel" role="img">
      <div
        v-for="item in chartItems"
        :key="item.key"
        class="account-profile-type-column"
        :class="{ 'is-total': item.key === 'total' }"
        :data-level-color="item.color === 'total' ? undefined : item.color"
      >
        <strong>{{ item.value ?? '—' }}</strong>
        <div class="account-profile-type-column-track" aria-hidden="true">
          <span :style="{ height: getBarHeight(item.value) }"></span>
        </div>
        <span>{{ item.label }}</span>
      </div>
    </div>

    <p v-if="!hasTypeData" class="account-profile-type-note">
      题目完成记录接入后，这里会使用固定颜色展示真实题型数量。
    </p>
  </section>
</template>
