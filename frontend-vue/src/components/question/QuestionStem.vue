<script setup>
defineProps({
  problem: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <section class="question-stem-panel" aria-labelledby="question-stem-title">
    <h2 id="question-stem-title" class="question-visually-hidden">题目内容</h2>
    <div class="question-stem-content">
      <pre>{{ problem.content }}</pre>
    </div>
  </section>
</template>
