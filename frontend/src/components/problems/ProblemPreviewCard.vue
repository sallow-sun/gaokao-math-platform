<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ProblemExportMenu from './ProblemExportMenu.vue'
import ProblemEngagementBar from './ProblemEngagementBar.vue'
import ProblemSolutionDrawer from './ProblemSolutionDrawer.vue'
import MathText from '../content/MathText.vue'
import ProblemAssets from '../content/ProblemAssets.vue'
import { normalizeProblemPrintContent } from '../../composables/useProblemPrintPreferences.js'

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
  printNote: {
    type: String,
    default: '',
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
          <RouterLink
            v-show="displayOptions['problem-id']"
            class="bank-problem-id"
            :to="{ name: 'question', params: { problemNumber: problem.id } }"
          >
            {{ problem.id }}
          </RouterLink>
          <span
            v-show="displayOptions['problem-id']"
            class="bank-problem-id-separator"
            aria-hidden="true"
          >
            |
          </span>
          <span class="bank-problem-type">{{ problem.typeLabel }}</span>
        </p>
        <h3 class="bank-problem-title">
          <RouterLink :to="{ name: 'question', params: { problemNumber: problem.id } }">
            {{ problem.title }}
          </RouterLink>
        </h3>
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
      <MathText class="bank-problem-screen-content" :text="problem.content" />
      <div class="bank-problem-print-content" aria-hidden="true">
        <span class="bank-problem-print-type-prefix">【{{ problem.typeLabel }}】</span>
        <MathText :text="printContent" />
      </div>
      <ProblemAssets :assets="problem.assets" />
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
        <RouterLink
          class="bank-result-problem-detail-link"
          :to="{ name: 'question', params: { problemNumber: problem.id } }"
        >
          查看详情
        </RouterLink>
        <button type="button" @click="emit('add-to-list')">
          {{ inPracticeList ? '管理题单' : '加入题单' }}
        </button>
      </div>
    </footer>

    <section v-if="printing && printNote" class="bank-problem-print-note">
      <h4>个人备注</h4>
      <pre>{{ printNote }}</pre>
    </section>

    <ProblemSolutionDrawer
      v-if="!printing"
      :open="solutionOpen"
      :problem="problem"
      @close="emit('toggle-solution')"
    />
  </article>
</template>
