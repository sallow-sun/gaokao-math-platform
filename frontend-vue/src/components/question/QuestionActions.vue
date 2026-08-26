<script setup>
defineProps({
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
  <div class="question-info-actions" role="group" aria-label="题目本地操作">
    <button type="button" :aria-pressed="completed" @click="emit('toggle-completed')">
      {{ completed ? '取消已做' : '标记已做' }}
    </button>
    <button type="button" disabled title="练习记录页面尚未接入">练习记录</button>
    <button type="button" :aria-pressed="favorite" @click="emit('toggle-favorite')">
      {{ favorite ? '取消收藏' : '收藏题目' }}
    </button>
    <button type="button" disabled title="题目反馈页面尚未接入">题目反馈</button>
  </div>
</template>
