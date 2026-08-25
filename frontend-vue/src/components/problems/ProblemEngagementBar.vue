<script setup>
defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  favorite: {
    type: Boolean,
    default: false,
  },
  problemId: {
    type: String,
    required: true,
  },
  solutionOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-completed', 'toggle-favorite', 'toggle-solution'])
</script>

<template>
  <div class="bank-problem-engagement-bar" :class="{ 'is-compact': compact }">
    <button
      class="bank-problem-engagement-button"
      type="button"
      :aria-controls="`problem-solution-${problemId}`"
      :aria-expanded="solutionOpen"
      @click="emit('toggle-solution')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4.5 4.75h15a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-8.3l-4.7 3v-3h-2a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z"
        />
      </svg>
      <span>{{ solutionOpen ? '收起题解' : '快速查看题解' }}</span>
      <svg class="bank-problem-engagement-chevron" viewBox="0 0 20 20" aria-hidden="true">
        <path :d="solutionOpen ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'" />
      </svg>
    </button>

    <button
      class="bank-problem-engagement-button"
      :class="{ 'is-active': completed }"
      type="button"
      :aria-pressed="completed"
      @click="emit('toggle-completed')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.6 2.6L16.5 9" />
      </svg>
      <span>{{ completed ? '已标记已做' : '标记已做' }}</span>
    </button>

    <button
      class="bank-problem-engagement-button"
      :class="{ 'is-active': favorite }"
      type="button"
      :aria-pressed="favorite"
      @click="emit('toggle-favorite')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
      </svg>
      <span>{{ favorite ? '已收藏' : '加入收藏' }}</span>
    </button>
  </div>
</template>
