<script setup>
import ProblemEngagementBar from './ProblemEngagementBar.vue'
import ProblemSolutionDrawer from './ProblemSolutionDrawer.vue'

defineProps({
  completed: {
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
  'selection-change',
  'toggle-completed',
  'toggle-favorite',
  'toggle-solution',
])
</script>

<template>
  <div
    class="bank-result-problem-list-entry"
    :class="{ 'is-complete': completed, 'is-selected': selected }"
  >
    <article
      class="bank-result-problem-panel-view-item"
      :data-problem-id="problem.id"
      :data-year="problem.year"
      :data-source="problem.source"
      :data-type="problem.type"
      :data-level="problem.level"
    >
      <label class="bank-result-problem-select">
        <input
          class="bank-result-problem-select-checkbox"
          type="checkbox"
          :checked="selected"
          :aria-label="`选择题目 ${problem.id}`"
          @change="emit('selection-change', $event.target.checked)"
        />
      </label>

      <span
        class="bank-result-problem-panel-view-item-status"
        :aria-label="completed ? '已完成' : '未完成'"
      >
        {{ completed ? '✓' : '○' }}
      </span>

      <div class="bank-result-problem-panel-view-item-summary">
        <p class="bank-problem-meta">
          <span class="bank-problem-id">{{ problem.id }}</span>
          <span aria-hidden="true">|</span>
          <span>{{ problem.typeLabel }}</span>
        </p>
        <h3>{{ problem.title }}</h3>
        <p class="bank-problem-detail">{{ problem.detail }}</p>
      </div>

      <div class="bank-result-problem-panel-view-item-tags">
        <span v-for="tag in problem.tags" :key="tag">{{ tag }}</span>
      </div>

      <div class="bank-result-problem-panel-view-item-source">
        <strong>{{ problem.year }}</strong>
        <span>{{ problem.sourceLabel }}</span>
      </div>

      <div class="bank-result-problem-panel-view-item-value" :data-level-color="problem.level">
        <span>{{ problem.level }}</span>
      </div>

      <button
        class="bank-result-problem-open"
        type="button"
        disabled
        :aria-label="`查看题目 ${problem.id}（详情页尚未迁移）`"
        title="题目详情页尚未迁移"
      >
        →
      </button>
    </article>

    <ProblemEngagementBar
      compact
      :completed="completed"
      :favorite="favorite"
      :problem-id="problem.id"
      :solution-open="solutionOpen"
      @toggle-completed="emit('toggle-completed')"
      @toggle-favorite="emit('toggle-favorite')"
      @toggle-solution="emit('toggle-solution')"
    />

    <ProblemSolutionDrawer
      :open="solutionOpen"
      :problem="problem"
      @close="emit('toggle-solution')"
    />
  </div>
</template>
