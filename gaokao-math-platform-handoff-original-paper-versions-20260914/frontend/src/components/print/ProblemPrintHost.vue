<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import ProblemPreviewCard from '../problems/ProblemPreviewCard.vue'
import MathText from '../content/MathText.vue'
import { finishProblemPrint, useProblemPrint } from '../../composables/useProblemPrint.js'

const { activePrintJob } = useProblemPrint()

const displayOptions = computed(() => ({
  export: false,
  'problem-id': Boolean(activePrintJob.value?.options?.['problem-id']),
  selection: false,
  source: Boolean(activePrintJob.value?.options?.source),
  tags: Boolean(activePrintJob.value?.options?.tags),
  value: Boolean(activePrintJob.value?.options?.value),
}))
const twoPerPageGroups = computed(() => {
  const entries = activePrintJob.value?.entries ?? []
  const pages = []

  for (let index = 0; index < entries.length; index += 2) {
    pages.push(entries.slice(index, index + 2))
  }

  return pages
})

function printAnswer(entry) {
  return activePrintJob.value?.options?.answer ? String(entry.problem.answer || '').trim() : ''
}

function printSolution(entry) {
  return activePrintJob.value?.options?.solution ? String(entry.problem.solution || '').trim() : ''
}

onMounted(() => {
  window.addEventListener('afterprint', finishProblemPrint)
})

onBeforeUnmount(() => {
  window.removeEventListener('afterprint', finishProblemPrint)
  finishProblemPrint()
})
</script>

<template>
  <section
    id="print-view"
    class="bank-print-results problem-print-host"
    :class="`is-print-${activePrintJob?.pageLayout ?? 'auto'}`"
    aria-hidden="true"
  >
    <template v-if="activePrintJob?.pageLayout === 'two-per-page'">
      <section
        v-for="(pageEntries, pageIndex) in twoPerPageGroups"
        :key="pageEntries[0].key"
        class="problem-print-two-page"
      >
        <div
          v-for="(entry, entryIndex) in pageEntries"
          :key="entry.key"
          class="problem-print-half-page"
        >
          <header
            v-if="activePrintJob.includeHeader && pageIndex === 0 && entryIndex === 0"
            class="problem-print-header"
          >
            <p>{{ activePrintJob.header?.eyebrow ?? '高考数学练习' }}</p>
            <h1>{{ activePrintJob.header?.title ?? '练习卷' }}</h1>
            <div class="problem-print-candidate-fields">
              <span>姓名：________________</span>
              <span>班级：________________</span>
              <span>日期：________________</span>
            </div>
            <p>共 {{ activePrintJob.entries.length }} 题</p>
          </header>

          <ProblemPreviewCard
            :display-options="displayOptions"
            :print-note="entry.note"
            :problem="entry.problem"
            printing
          />
          <section v-if="printAnswer(entry)" class="problem-print-answer">
            <h2>答案</h2>
            <MathText :text="printAnswer(entry)" />
          </section>
          <section v-if="printSolution(entry)" class="problem-print-answer">
            <h2>解析</h2>
            <MathText :text="printSolution(entry)" />
          </section>
        </div>
      </section>
    </template>

    <template v-else-if="activePrintJob">
      <header v-if="activePrintJob.includeHeader" class="problem-print-header">
        <p>{{ activePrintJob.header?.eyebrow ?? '高考数学练习' }}</p>
        <h1>{{ activePrintJob.header?.title ?? '练习卷' }}</h1>
        <div class="problem-print-candidate-fields">
          <span>姓名：________________</span>
          <span>班级：________________</span>
          <span>日期：________________</span>
        </div>
        <p>共 {{ activePrintJob.entries.length }} 题</p>
      </header>

      <article v-for="entry in activePrintJob.entries" :key="entry.key" class="problem-print-entry">
        <ProblemPreviewCard
          :display-options="displayOptions"
          :print-note="entry.note"
          :problem="entry.problem"
          printing
        />
        <section v-if="printAnswer(entry)" class="problem-print-answer">
          <h2>答案</h2>
          <MathText :text="printAnswer(entry)" />
        </section>
        <section v-if="printSolution(entry)" class="problem-print-answer">
          <h2>解析</h2>
          <MathText :text="printSolution(entry)" />
        </section>
      </article>
    </template>
  </section>
</template>
