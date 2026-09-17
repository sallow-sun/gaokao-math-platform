<script setup>
import { computed, ref } from 'vue'

const active = ref(null),
  highlighted = ref('')
const TRAINING_LEVELS = Object.freeze([
  { key: 'red', label: '红', color: '#d16c68' },
  { key: 'orange', label: '橙', color: '#dc995f' },
  { key: 'yellow', label: '黄', color: '#ceb559' },
  { key: 'green', label: '绿', color: '#79a187' },
  { key: 'cyan', label: '青', color: '#65a6ae' },
  { key: 'blue', label: '蓝', color: '#668dc3' },
  { key: 'purple', label: '紫', color: '#a18ac2' },
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
      key: String(item.key || index),
      label: String(item.label || '未命名标签'),
      segments,
      total,
    }
  }),
)
const hasTagData = computed(() => normalizedItems.value.some((item) => item.total > 0))

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
      <span>{{ hasTagData ? '难度构成' : '暂无记录' }}</span>
    </header>

    <div class="account-profile-tag-list">
      <div
        v-for="item in normalizedItems"
        :key="item.key"
        class="account-profile-tag-row"
        :aria-label="getTagAriaLabel(item)"
        role="button"
        tabindex="0"
        :aria-expanded="active === item.key"
        @pointerenter="e => { if (e.pointerType === 'mouse') active = item.key }"
        @pointerleave="e => { if (e.pointerType === 'mouse') { active = null; highlighted = '' } }"
        @focus="active = item.key"
        @blur="active = null"
        @click="active = item.key"
        @keydown.enter.prevent="active = active === item.key ? null : item.key"
        @keydown.space.prevent="active = active === item.key ? null : item.key"
        @keydown.esc="active = null"
      >
        <strong>{{ item.label }}</strong>
        <div
          class="account-profile-tag-track"
          :class="{ 'has-data': item.total > 0 }"
          aria-hidden="true"
        >
          <i
            v-for="segment in item.segments"
            :key="segment.key"
            :style="{ width: `${(segment.count / item.total) * 100}%`, background: segment.color }"
            @mouseenter="highlighted = segment.key"
            @mouseleave="highlighted = ''"
          ></i>
        </div>
        <span>{{ item.total || '—' }}</span>
        <div v-if="active === item.key" class="tag-stat-tooltip" role="tooltip">
          <strong>{{ item.label }} · 共 {{ item.total }} 题</strong>
          <p
            v-for="segment in item.segments"
            :key="segment.key"
            :class="{ highlighted: highlighted === segment.key }"
          >
            <i :style="{ background: segment.color }"></i>{{ segment.key.toUpperCase() }}：{{
              segment.count
            }}
            题
          </p>
          <p v-if="!item.total">暂无已完成题目</p>
        </div>
      </div>
    </div>

    <footer class="account-profile-tag-footer">
      <p v-if="!hasTagData">完成题目后，这里会显示各标签的难度构成。</p>
      <div class="account-profile-tag-legend" aria-label="训练颜色图例">
        <span v-for="level in TRAINING_LEVELS" :key="level.key">
          <i :style="{ background: level.color }" aria-hidden="true"></i>{{ level.label }}
        </span>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.account-profile-tag-row {
  position: relative;
  cursor: pointer;
  border-radius: 4px;
}
.account-profile-tag-row:focus-visible {
  outline: 2px solid #668dc3;
  outline-offset: 4px;
}
.account-profile-tag-track {
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: #edf2f7;
}
.account-profile-tag-track i {
  height: 100%;
  box-sizing: border-box;
  border-right: 1px solid white;
}
.tag-stat-tooltip {
  position: absolute;
  z-index: 15;
  right: 24px;
  bottom: calc(100% + 8px);
  min-width: 180px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #d9e3ed;
  border-radius: 8px;
  box-shadow: 0 8px 28px #21374a20;
  color: #314f68;
  font-size: 13px;
  pointer-events: none;
}
.tag-stat-tooltip p {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0;
}
.tag-stat-tooltip i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.tag-stat-tooltip .highlighted {
  font-weight: 700;
}
</style>
