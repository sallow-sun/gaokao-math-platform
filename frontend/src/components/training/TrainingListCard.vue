<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  completedCount: {
    type: Number,
    default: 0,
  },
  defaultList: {
    type: Boolean,
    default: false,
  },
  practiceList: {
    type: Object,
    required: true,
  },
})

const problemCount = computed(
  () => props.practiceList.problemCount ?? props.practiceList.items?.length ?? 0,
)
const listKindLabel = computed(() => {
  if (props.practiceList.isOfficial) return '官方题单'
  if (props.practiceList.id?.startsWith('local-')) return '本地题单'
  return props.practiceList.isPublic === false ? '私密题单' : '公开题单'
})
const progressPercent = computed(() => {
  if (problemCount.value === 0) {
    return 0
  }

  return Math.round((props.completedCount / problemCount.value) * 100)
})
const updatedAt = computed(() => {
  const date = new Date(props.practiceList.updatedAt)

  if (Number.isNaN(date.getTime())) {
    return '更新时间未知'
  }

  return `${new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)} 更新`
})
</script>

<template>
  <article class="training-card">
    <div class="training-card-copy">
      <div class="training-card-labels">
        <span class="training-card-code">{{ listKindLabel }}</span>
        <span v-if="defaultList" class="training-card-default">默认</span>
      </div>
      <h3>{{ practiceList.title }}</h3>
      <p class="training-card-description">
        {{ practiceList.description || '还没有填写题单说明。' }}
      </p>
      <p class="training-card-meta">
        <span>{{ problemCount }} 题</span>
        <span v-if="practiceList.owner">作者：{{ practiceList.owner.username }}</span>
        <span>{{ updatedAt }}</span>
      </p>
      <RouterLink
        class="training-card-open"
        :to="{
          name: 'training-detail',
          params: { practiceListId: practiceList.id },
        }"
      >
        打开题单 <span aria-hidden="true">→</span>
      </RouterLink>
    </div>

    <span
      class="training-card-progress"
      :class="{ 'is-complete': problemCount > 0 && completedCount >= problemCount }"
      :style="{ '--progress': progressPercent }"
      :aria-label="`已完成 ${completedCount} 题，共 ${problemCount} 题`"
    >
      <span>{{ completedCount }} / {{ problemCount }}</span>
    </span>
  </article>
</template>
