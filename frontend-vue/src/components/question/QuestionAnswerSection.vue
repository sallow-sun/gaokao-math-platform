<script setup>
import { computed } from 'vue'
import QuestionSidebarSection from './QuestionSidebarSection.vue'

const props = defineProps({
  problem: {
    type: Object,
    required: true,
  },
})

function normalizeOptionalText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const answer = computed(() => normalizeOptionalText(props.problem.answer))
const solution = computed(() => normalizeOptionalText(props.problem.solution))
</script>

<template>
  <QuestionSidebarSection
    section-id="question-answer"
    title="答案解析"
    collapsed-text="显示答案"
    expanded-text="收起答案"
    header-action-label="进入题解区"
    header-action-hint="题解区路由尚未接入"
  >
    <div v-if="answer" class="question-sidebar-answer-block">
      <h3>答案</h3>
      <pre>{{ answer }}</pre>
    </div>

    <div v-if="solution" class="question-sidebar-answer-block">
      <h3>解析</h3>
      <pre>{{ solution }}</pre>
    </div>

    <p v-if="!answer && !solution" class="question-sidebar-empty">答案与解析数据接口尚未接入。</p>
  </QuestionSidebarSection>
</template>
