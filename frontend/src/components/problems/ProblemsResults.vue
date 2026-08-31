<script setup>
import { computed } from 'vue'
import ProblemListItem from './ProblemListItem.vue'
import ProblemPreviewCard from './ProblemPreviewCard.vue'

const props = defineProps({
  displayOptions: {
    type: Object,
    required: true,
  },
  completedProblemIds: {
    type: Array,
    required: true,
  },
  favoriteProblemIds: {
    type: Array,
    required: true,
  },
  openSolutionProblemIds: {
    type: Array,
    required: true,
  },
  problems: {
    type: Array,
    required: true,
  },
  practiceProblemIds: {
    type: Array,
    required: true,
  },
  selectedProblemIds: {
    type: Array,
    required: true,
  },
  viewMode: {
    type: String,
    required: true,
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

const isMinimalDisplay = computed(
  () =>
    !props.displayOptions.selection && !props.displayOptions.tags && !props.displayOptions.value,
)
</script>

<template>
  <section
    v-show="viewMode === 'preview-view'"
    id="preview-view"
    class="bank-result-problem-panel-view"
    :class="{
      'is-minimal-display': isMinimalDisplay,
      'is-selection-hidden': !displayOptions.selection,
    }"
    :data-empty="problems.length === 0"
  >
    <ProblemPreviewCard
      v-for="problem in problems"
      :key="problem.id"
      :display-options="displayOptions"
      :completed="completedProblemIds.includes(problem.id)"
      :favorite="favoriteProblemIds.includes(problem.id)"
      :in-practice-list="practiceProblemIds.includes(problem.id)"
      :problem="problem"
      :selected="selectedProblemIds.includes(problem.id)"
      :solution-open="openSolutionProblemIds.includes(problem.id)"
      @add-to-list="emit('add-to-list', problem.id)"
      @export="emit('export', { format: $event, problem })"
      @print="emit('print', problem)"
      @selection-change="emit('selection-change', { problemId: problem.id, selected: $event })"
      @toggle-completed="emit('toggle-completed', problem.id)"
      @toggle-favorite="emit('toggle-favorite', problem.id)"
      @toggle-solution="emit('toggle-solution', problem.id)"
    />
  </section>

  <section
    v-show="viewMode === 'list-view'"
    id="list-view"
    class="bank-result-problem-panel-view"
    :data-empty="problems.length === 0"
  >
    <div class="bank-result-problem-list-heading" role="row" aria-label="题目列表标题栏">
      <span aria-hidden="true"></span>
      <span role="columnheader">状态</span>
      <span role="columnheader">题目</span>
      <span role="columnheader">Tag</span>
      <span role="columnheader">来源</span>
      <span role="columnheader">训练价值</span>
      <span aria-hidden="true"></span>
    </div>

    <ProblemListItem
      v-for="problem in problems"
      :key="problem.id"
      :completed="completedProblemIds.includes(problem.id)"
      completion-toggleable
      :problem="problem"
      :selected="selectedProblemIds.includes(problem.id)"
      @selection-change="emit('selection-change', { problemId: problem.id, selected: $event })"
      @toggle-completed="emit('toggle-completed', problem.id)"
    />
  </section>
</template>
