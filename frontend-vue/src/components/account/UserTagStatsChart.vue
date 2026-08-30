<script setup>
import { computed } from 'vue'

const TRAINING_LEVELS = Object.freeze([
  { key: 'red', label: '红', color: '#a34c43' },
  { key: 'orange', label: '橙', color: '#ba7a52' },
  { key: 'yellow', label: '黄', color: '#c1a869' },
  { key: 'green', label: '绿', color: '#6b8a60' },
  { key: 'cyan', label: '青', color: '#5c8086' },
  { key: 'blue', label: '蓝', color: '#566b8c' },
  { key: 'purple', label: '紫', color: '#765c82' },
  { key: 'black', label: '黑', color: '#252a30' },
  { key: 'white', label: '白', color: '#ffffff' },
])

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const normalizedItems = computed(() =>
  props.items.map((item, index) => {
    const sourceSegments = Array.isArray(item.segments) ? item.segments : []
    const segmentCounts = new Map()

    sourceSegments.forEach((segment) => {
      const level = String(segment.level ?? '').trim()
      const count = Number(segment.count)

      if (
        TRAINING_LEVELS.some((option) => option.key === level) &&
        Number.isFinite(count) &&
        count > 0
      ) {
        segmentCounts.set(level, (segmentCounts.get(level) ?? 0) + count)
      }
    })

    const segments = TRAINING_LEVELS.filter((level) => segmentCounts.has(level.key)).map(
      (level) => ({
        ...level,
        count: segmentCounts.get(level.key),
      }),
    )
    const total = segments.reduce((sum, segment) => sum + segment.count, 0)

    return {
      gradient: buildRainbowGradient(segments, total),
      key: String(item.key || index),
      label: String(item.label || '未命名标签'),
      segments,
      total,
    }
  }),
)
const hasTagData = computed(() => normalizedItems.value.some((item) => item.total > 0))

function buildRainbowGradient(segments, total) {
  if (segments.length === 0 || total <= 0) {
    return ''
  }

  if (segments.length === 1) {
    return `linear-gradient(90deg, ${segments[0].color} 0%, ${segments[0].color} 100%)`
  }

  const stops = [`${segments[0].color} 0%`]
  let cumulativePercentage = 0

  segments.forEach((segment, index) => {
    const segmentPercentage = (segment.count / total) * 100
    cumulativePercentage += segmentPercentage

    if (index === segments.length - 1) {
      stops.push(`${segment.color} 100%`)
      return
    }

    const nextSegment = segments[index + 1]
    const nextPercentage = (nextSegment.count / total) * 100
    const fadeHalfWidth = Math.min(1.2, segmentPercentage / 4, nextPercentage / 4)
    const fadeStart = Math.max(0, cumulativePercentage - fadeHalfWidth)
    const fadeEnd = Math.min(100, cumulativePercentage + fadeHalfWidth)

    stops.push(
      `${segment.color} ${fadeStart.toFixed(2)}%`,
      `${nextSegment.color} ${fadeEnd.toFixed(2)}%`,
    )
  })

  return `linear-gradient(90deg, ${stops.join(', ')})`
}

function getTagAriaLabel(item) {
  if (item.total <= 0) {
    return `${item.label}：暂无已完成题目统计`
  }

  const segmentSummary = item.segments
    .map((segment) => `${segment.label}色${segment.count}道`)
    .join('，')
  return `${item.label}：共${item.total}道，${segmentSummary}`
}
</script>

<template>
  <section class="account-profile-chart-card account-profile-tag-card">
    <header class="account-profile-chart-heading">
      <div>
        <h2>Tags 统计</h2>
        <p>按知识标签汇总已完成题目，并显示训练颜色构成</p>
      </div>
      <span>{{ hasTagData ? '训练颜色占比' : '数据待接入' }}</span>
    </header>

    <div class="account-profile-tag-list">
      <div
        v-for="item in normalizedItems"
        :key="item.key"
        class="account-profile-tag-row"
        :aria-label="getTagAriaLabel(item)"
        role="img"
      >
        <strong>{{ item.label }}</strong>
        <div
          class="account-profile-tag-track"
          :class="{ 'has-data': item.total > 0 }"
          :style="item.gradient ? { backgroundImage: item.gradient } : undefined"
          aria-hidden="true"
        ></div>
        <span>{{ item.total || '—' }}</span>
      </div>
    </div>

    <footer class="account-profile-tag-footer">
      <p v-if="!hasTagData">已做题目的标签和训练颜色接入后，每条会按实际数量比例自然混合着色。</p>
      <div class="account-profile-tag-legend" aria-label="训练颜色图例">
        <span v-for="level in TRAINING_LEVELS" :key="level.key">
          <i :style="{ background: level.color }" aria-hidden="true"></i>{{ level.label }}
        </span>
      </div>
    </footer>
  </section>
</template>
