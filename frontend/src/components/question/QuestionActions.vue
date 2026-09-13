<script setup>
import MistakeButton from './MistakeButton.vue'
defineProps({
  problemNumber: { type: String, required: true },
  completed: {
    type: Boolean,
    default: false,
  },
  favorite: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-completed', 'toggle-favorite'])
</script>

<template>
  <div class="question-info-actions" role="group" aria-label="题目操作">
    <button type="button" :aria-pressed="completed" @click="emit('toggle-completed')">
      {{ completed ? '取消已做' : '标记已做' }}
    </button>
    <MistakeButton :key="problemNumber" :number="problemNumber" />
    <button type="button" :aria-pressed="favorite" @click="emit('toggle-favorite')">
      {{ favorite ? '取消收藏' : '收藏题目' }}
    </button>
    <RouterLink :to="{ name: 'feedback', query: { number: problemNumber } }">题目反馈</RouterLink>
  </div>
</template>
