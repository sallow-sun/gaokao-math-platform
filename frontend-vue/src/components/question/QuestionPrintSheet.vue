<script setup>
import { computed } from 'vue'
import { normalizeProblemPrintContent } from '../../composables/useProblemsPrintPreferences.js'

const props = defineProps({
  options: {
    type: Object,
    required: true,
  },
  problem: {
    type: Object,
    required: true,
  },
})

const answer = computed(() => String(props.problem.answer || '').trim())
const content = computed(() => normalizeProblemPrintContent(props.problem.content))
const solution = computed(() => String(props.problem.solution || '').trim())
const source = computed(
  () =>
    props.problem.sourceText ||
    [props.problem.year, props.problem.sourceLabel].filter(Boolean).join(' · '),
)
const tags = computed(() =>
  Array.isArray(props.problem.tags) ? props.problem.tags.filter(Boolean) : [],
)
</script>

<template>
  <article class="question-print-sheet">
    <header
      v-if="options['problem-id'] || options.title || options.tags || options.value"
      class="question-print-header"
    >
      <p v-if="options['problem-id']" class="question-print-id">题号：{{ problem.id }}</p>
      <h1 v-if="options.title">{{ problem.title }}</h1>
      <p v-if="options.tags && tags.length" class="question-print-tags">
        知识点：{{ tags.join('、') }}
      </p>
      <p v-if="options.value" class="question-print-value">
        训练价值：{{ String(problem.level || '未知').toUpperCase() }}
      </p>
    </header>

    <section
      v-if="options.type || options.content"
      class="question-print-problem"
      :class="{ 'without-type': !options.type }"
      aria-label="题目内容"
    >
      <strong v-if="options.type" class="question-print-type">【{{ problem.typeLabel }}】</strong>
      <pre v-if="options.content">{{ content }}</pre>
    </section>

    <p v-if="options.source && source" class="question-print-source">来源：{{ source }}</p>

    <section v-if="options.answer && answer" class="question-print-answer">
      <h2>答案</h2>
      <pre>{{ answer }}</pre>
    </section>

    <section v-if="options.solution && solution" class="question-print-answer">
      <h2>解析</h2>
      <pre>{{ solution }}</pre>
    </section>
  </article>
</template>
