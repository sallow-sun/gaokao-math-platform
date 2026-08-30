<script setup>
import { computed } from 'vue'

const TOTAL_WEEKS = 53
const DAYS_PER_WEEK = 7
const TOTAL_CELLS = TOTAL_WEEKS * DAYS_PER_WEEK

const props = defineProps({
  records: {
    type: Array,
    default: () => [],
  },
})

const normalizedRecords = computed(() =>
  props.records
    .filter((record) => record && typeof record === 'object')
    .slice(-TOTAL_CELLS)
    .map((record) => ({
      count: Number.isFinite(Number(record.count)) ? Math.max(0, Number(record.count)) : 0,
      date: String(record.date ?? '').trim(),
    })),
)
const hasActivityData = computed(() => normalizedRecords.value.length > 0)
const activityCells = computed(() => {
  const emptyCellCount = TOTAL_CELLS - normalizedRecords.value.length

  return [
    ...Array.from({ length: emptyCellCount }, (_, index) => ({
      count: null,
      date: '',
      key: `pending-${index}`,
    })),
    ...normalizedRecords.value.map((record, index) => ({
      ...record,
      key: record.date || `activity-${index}`,
    })),
  ]
})
const monthLabels = computed(() => {
  const formatter = new Intl.DateTimeFormat('zh-CN', { month: 'short' })
  const currentDate = new Date()

  return Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11 + index, 1)
    return formatter.format(monthDate)
  })
})

function getActivityLevel(count) {
  if (!Number.isFinite(count) || count <= 0) {
    return 0
  }

  if (count <= 2) {
    return 1
  }

  if (count <= 5) {
    return 2
  }

  if (count <= 9) {
    return 3
  }

  return 4
}

function getCellLabel(cell) {
  if (!cell.date) {
    return ''
  }

  return `${cell.date}：完成 ${cell.count} 道题`
}
</script>

<template>
  <section class="account-profile-chart-card account-profile-heatmap-card">
    <header class="account-profile-chart-heading">
      <div>
        <h2>做题活跃度</h2>
        <p>过去一年的每日完成数量</p>
      </div>
      <span>{{ hasActivityData ? '过去一年' : '数据待接入' }}</span>
    </header>

    <div
      class="account-profile-heatmap-viewport"
      :aria-label="
        hasActivityData
          ? '过去一年做题活跃度热力图'
          : '做题完成日期尚未接入，当前热力图不展示学习记录'
      "
      role="img"
    >
      <div class="account-profile-heatmap-content">
        <div class="account-profile-heatmap-months" aria-hidden="true">
          <span v-for="month in monthLabels" :key="month">{{ month }}</span>
        </div>

        <div class="account-profile-heatmap-body">
          <div class="account-profile-heatmap-days" aria-hidden="true">
            <span>一</span>
            <span>三</span>
            <span>五</span>
          </div>

          <div class="account-profile-heatmap-grid" aria-hidden="true">
            <span
              v-for="cell in activityCells"
              :key="cell.key"
              :class="`is-level-${getActivityLevel(cell.count)}`"
              :title="getCellLabel(cell)"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <footer class="account-profile-chart-footer">
      <p v-if="!hasActivityData">完成日期接口确定后，这里会按天显示真实学习记录。</p>
      <span class="account-profile-heatmap-legend" aria-label="颜色越深表示当天完成题目越多">
        少
        <i v-for="level in 5" :key="level" :class="`is-level-${level - 1}`"></i>
        多
      </span>
    </footer>
  </section>
</template>
