<script setup>
import { computed } from 'vue'
import ProblemPreviewCard from '../problems/ProblemPreviewCard.vue'
import { formatPracticeListProblemContent } from '../../composables/usePracticeListArrangement.js'

const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  includeNotes: {
    type: Boolean,
    default: true,
  },
  includePrintHeader: {
    type: Boolean,
    default: false,
  },
  practiceList: {
    type: Object,
    required: true,
  },
})

const printableEntries = computed(() =>
  props.entries.map((entry, index) => ({
    ...entry,
    printProblem: {
      ...entry.problem,
      content: formatPracticeListProblemContent(
        entry.problem?.content,
        entry.position ?? index + 1,
      ),
    },
  })),
)

const PRINT_DISPLAY_OPTIONS = Object.freeze({
  export: false,
  'problem-id': true,
  selection: false,
  source: true,
  tags: true,
  value: true,
})
</script>

<template>
  <section id="print-view" class="bank-print-results training-print-sheet" aria-hidden="true">
    <header v-if="includePrintHeader" class="training-print-header">
      <p>高考数学题单</p>
      <h1>{{ practiceList.title }}</h1>
      <div class="training-print-candidate-fields">
        <span>姓名：________________</span>
        <span>班级：________________</span>
        <span>日期：________________</span>
      </div>
      <p class="training-print-count">共 {{ printableEntries.length }} 题</p>
    </header>

    <ProblemPreviewCard
      v-for="entry in printableEntries"
      :key="entry.item.problemId"
      :display-options="PRINT_DISPLAY_OPTIONS"
      :print-note="includeNotes ? entry.item.note : ''"
      :problem="entry.printProblem"
      printing
    />
  </section>
</template>
