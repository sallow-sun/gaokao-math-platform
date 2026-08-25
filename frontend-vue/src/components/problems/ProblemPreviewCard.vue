<script setup>
import { computed } from 'vue'
import ProblemExportMenu from './ProblemExportMenu.vue'
import ProblemEngagementBar from './ProblemEngagementBar.vue'
import ProblemSolutionDrawer from './ProblemSolutionDrawer.vue'
import { normalizeProblemPrintContent } from '../../composables/useProblemsPrintPreferences.js'

const props = defineProps({
  completed: {
    type: Boolean,
    default: false,
  },
  displayOptions: {
    type: Object,
    required: true,
  },
  inPracticeList: {
    type: Boolean,
    default: false,
  },
  favorite: {
    type: Boolean,
    default: false,
  },
  problem: {
    type: Object,
    required: true,
  },
  printing: {
    type: Boolean,
    default: false,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  solutionOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'add-to-list',
  'export',
  'print',
  'selection-change',
  'toggle-completed',
  'toggle-favorite',
  'toggle-solution',
])
const printContent = computed(() => normalizeProblemPrintContent(props.problem.content))
</script>

<template>
  <article
    class="bank-result-problem-panel-view-card"
    :class="{
      'is-selected': selected,
      'is-selected-for-print': printing,
    }"
    :data-problem-id="problem.id"
    :data-year="problem.year"
    :data-source="problem.source"
    :data-type="problem.type"
    :data-level="problem.level"
  >
    <header class="bank-result-problem-panel-view-card-header">
      <label v-if="displayOptions.selection" class="bank-result-problem-select">
        <input
          class="bank-result-problem-select-checkbox"
          type="checkbox"
          :checked="selected"
          :aria-label="`选择题目 ${problem.id}`"
          @change="emit('selection-change', $event.target.checked)"
        />
      </label>

      <div class="bank-result-problem-panel-view-card-summary">
        <p class="bank-problem-meta">
          <span v-show="displayOptions['problem-id']" class="bank-problem-id">{{
            problem.id
          }}</span>
          <span
            v-show="displayOptions['problem-id']"
            class="bank-problem-id-separator"
            aria-hidden="true"
          >
            |
          </span>
          <span class="bank-problem-type">{{ problem.typeLabel }}</span>
        </p>
        <h3 class="bank-problem-title">{{ problem.title }}</h3>
      </div>

      <div v-show="displayOptions.tags" class="bank-result-problem-panel-view-card-tags">
        <span v-for="tag in problem.tags" :key="tag">{{ tag }}</span>
      </div>

      <div
        v-show="displayOptions.value"
        class="bank-result-problem-panel-view-card-value"
        :data-level-color="problem.level"
      >
        <span>{{ problem.level }}</span>
      </div>
    </header>

    <div class="bank-result-problem-panel-view-card-content">
      <pre class="bank-problem-screen-content">{{ problem.content }}</pre>
      <div class="bank-problem-print-content" aria-hidden="true">
        <span class="bank-problem-print-type-prefix">【{{ problem.typeLabel }}】</span>
        <pre>{{ printContent }}</pre>
      </div>
    </div>

    <footer class="bank-result-problem-panel-view-card-footer">
      <p v-show="displayOptions.source" class="bank-problem-source">{{ problem.sourceText }}</p>

      <ProblemEngagementBar
        v-if="!printing"
        :completed="completed"
        :favorite="favorite"
        :problem-id="problem.id"
        :solution-open="solutionOpen"
        @toggle-completed="emit('toggle-completed')"
        @toggle-favorite="emit('toggle-favorite')"
        @toggle-solution="emit('toggle-solution')"
      />

      <div class="bank-result-problem-panel-view-card-actions">
        <button type="button" @click="emit('print')">打印</button>
        <ProblemExportMenu v-show="displayOptions.export" @export="emit('export', $event)" />
        <button type="button" disabled title="题目详情页尚未迁移">查看详情</button>
        <button type="button" :disabled="inPracticeList" @click="emit('add-to-list')">
          {{ inPracticeList ? '已加入题单' : '加入题单' }}
        </button>
      </div>
    </footer>

    <ProblemSolutionDrawer
      v-if="!printing"
      :open="solutionOpen"
      :problem="problem"
      @close="emit('toggle-solution')"
    />
  </article>
</template>
