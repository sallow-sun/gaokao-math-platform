<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  completed: {
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
})

const emit = defineEmits(['selection-change'])
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
          <RouterLink
            class="bank-problem-id"
            :to="{ name: 'question', params: { problemNumber: problem.id } }"
          >
            {{ problem.id }}
          </RouterLink>
          <span aria-hidden="true">|</span>
          <span>{{ problem.typeLabel }}</span>
        </p>
        <h3>
          <RouterLink :to="{ name: 'question', params: { problemNumber: problem.id } }">
            {{ problem.title }}
          </RouterLink>
        </h3>
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

      <RouterLink
        class="bank-result-problem-open"
        :to="{ name: 'question', params: { problemNumber: problem.id } }"
        :aria-label="`查看题目 ${problem.id}`"
      >
        →
      </RouterLink>
    </article>
  </div>
</template>
