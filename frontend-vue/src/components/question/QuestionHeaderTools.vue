<script setup>
import ProblemExportMenu from '../problems/ProblemExportMenu.vue'

defineProps({
  inPracticeList: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['add-to-list', 'export', 'print'])
</script>

<template>
  <div class="question-header-tools" role="group" aria-label="题目操作">
    <button
      type="button"
      class="question-header-primary-action"
      :disabled="inPracticeList"
      @click="emit('add-to-list')"
    >
      {{ inPracticeList ? '已加入题单' : '加入题单' }}
    </button>
    <button type="button" @click="emit('print')">打印</button>
    <ProblemExportMenu trigger-label="导出" @export="emit('export', $event)" />
  </div>
</template>
