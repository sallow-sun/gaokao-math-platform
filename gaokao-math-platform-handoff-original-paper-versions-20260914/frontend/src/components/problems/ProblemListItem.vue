<script setup>
import { RouterLink } from 'vue-router'
import MathText from '../content/MathText.vue'

defineProps({
  completed: {
    type: Boolean,
    default: false,
  },
  completionToggleable: {
    type: Boolean,
    default: false,
  },
  problem: {
    type: Object,
    required: true,
  },
  position: {
    type: [Number, String],
    default: '',
  },
  removable: {
    type: Boolean,
    default: false,
  },
  reorderable: {
    type: Boolean,
    default: false,
  },
  selectable: {
    type: Boolean,
    default: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'drag-end',
  'drag-start',
  'move',
  'remove',
  'selection-change',
  'toggle-completed',
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
      <button
        v-if="reorderable"
        class="bank-result-problem-drag-handle"
        type="button"
        draggable="true"
        :aria-label="`拖动排序题目 ${problem.id}；也可使用上下方向键调整`"
        @click.prevent
        @dragstart="emit('drag-start', $event)"
        @dragend="emit('drag-end')"
        @keydown.up.prevent="emit('move', -1)"
        @keydown.down.prevent="emit('move', 1)"
      >
        <span aria-hidden="true">☰</span>
      </button>

      <label v-else-if="selectable" class="bank-result-problem-select">
        <input
          class="bank-result-problem-select-checkbox"
          type="checkbox"
          :checked="selected"
          :aria-label="`选择题目 ${problem.id}`"
          @change="emit('selection-change', $event.target.checked)"
        />
      </label>

      <span v-else class="bank-result-problem-position" aria-hidden="true">{{ position }}</span>

      <button
        v-if="completionToggleable"
        type="button"
        class="bank-result-problem-panel-view-item-status is-toggle"
        :class="{ 'is-complete': completed }"
        :aria-label="`${completed ? '标记为未做' : '标记为已做'}：${problem.id}`"
        :aria-pressed="completed"
        :title="completed ? '标记为未做' : '标记为已做'"
        @click="emit('toggle-completed', !completed)"
      >
        {{ completed ? '✓' : '' }}
      </button>

      <span
        v-else
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
          <slot name="meta-extra"></slot>
        </p>
        <h3>
          <RouterLink :to="{ name: 'question', params: { problemNumber: problem.id } }">
            {{ problem.title }}
          </RouterLink>
          <slot name="title-extra"></slot>
        </h3>
        <MathText class="bank-problem-detail" inline :text="problem.detail" />
        <slot name="summary-extra"></slot>
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
        v-if="removable"
        class="bank-result-problem-remove"
        type="button"
        :aria-label="`从题单移除题目 ${problem.id}`"
        @click="emit('remove')"
      >
        ×
      </button>

      <RouterLink
        v-else
        class="bank-result-problem-open"
        :to="{ name: 'question', params: { problemNumber: problem.id } }"
        :aria-label="`查看题目 ${problem.id}`"
      >
        →
      </RouterLink>
    </article>
  </div>
</template>
