<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ProblemListItem from '../problems/ProblemListItem.vue'
import MathText from '../content/MathText.vue'
import { stripPracticeListSourceNumber } from '../../composables/usePracticeListArrangement.js'

const props = defineProps({
  completed: {
    type: Boolean,
    default: false,
  },
  dragging: {
    type: Boolean,
    default: false,
  },
  dropPosition: {
    type: String,
    default: '',
    validator: (value) => ['', 'before', 'after'].includes(value),
  },
  editable: {
    type: Boolean,
    default: true,
  },
  index: {
    type: Number,
    required: true,
  },
  item: {
    type: Object,
    required: true,
  },
  noteActive: {
    type: Boolean,
    default: false,
  },
  problem: {
    type: Object,
    default: null,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  selectionMode: {
    type: Boolean,
    default: false,
  },
  total: {
    type: Number,
    required: true,
  },
  viewMode: {
    type: String,
    required: true,
    validator: (value) => ['preview-view', 'list-view'].includes(value),
  },
})

const emit = defineEmits([
  'drag-end',
  'drag-over',
  'drag-start',
  'drop',
  'edit-note',
  'move',
  'print',
  'remove',
  'selection-change',
  'toggle-completed',
])
const previewContent = computed(() => stripPracticeListSourceNumber(props.problem?.content))

function moveBy(offset) {
  const targetIndex = props.index + offset

  if (targetIndex >= 0 && targetIndex < props.total) {
    emit('move', targetIndex)
  }
}
</script>

<template>
  <article
    class="training-detail-problem"
    :class="[
      `is-${viewMode}`,
      {
        'is-dragging': dragging,
        'is-drop-before': dropPosition === 'before',
        'is-drop-after': dropPosition === 'after',
        'is-note-active': noteActive,
        'is-selected': selected,
      },
    ]"
    @dragover.prevent="viewMode === 'list-view' && emit('drag-over', $event)"
    @drop.prevent="viewMode === 'list-view' && emit('drop', $event)"
  >
    <section
      v-if="problem && viewMode === 'preview-view'"
      class="training-exam-problem"
      :aria-label="`第 ${index + 1} 题：${problem.title}`"
    >
      <div class="training-exam-problem-row">
        <strong>【{{ problem.typeLabel }}】</strong>
        <span>{{ index + 1 }}.</span>
        <MathText class="training-exam-problem-content" :text="previewContent" />
      </div>

      <div class="training-exam-problem-actions" aria-label="本题操作">
        <RouterLink
          :to="{ name: 'question', params: { problemNumber: item.problemId } }"
          :aria-label="`进入题目 ${item.problemId} 详情`"
        >
          详情
        </RouterLink>
        <button type="button" :aria-label="`打印题目 ${item.problemId}`" @click="emit('print')">
          打印
        </button>
        <button
          type="button"
          :aria-label="`${completed ? '标记为未做' : '标记为已做'}：${item.problemId}`"
          :aria-pressed="completed"
          @click="emit('toggle-completed', !completed)"
        >
          {{ completed ? '改为未做' : '标记已做' }}
        </button>
        <button
          v-if="editable"
          type="button"
          class="is-danger-text"
          :aria-label="`从题单移除题目 ${item.problemId}`"
          @click="emit('remove')"
        >
          移出题单
        </button>
      </div>
    </section>

    <ProblemListItem
      v-else-if="problem"
      :completed="completed"
      completion-toggleable
      :position="index + 1"
      :problem="problem"
      :removable="editable && !selectionMode"
      :reorderable="editable && !selectionMode"
      :selectable="editable && selectionMode"
      :selected="selected"
      @drag-end="emit('drag-end')"
      @drag-start="emit('drag-start', $event)"
      @move="moveBy"
      @remove="emit('remove')"
      @selection-change="emit('selection-change', $event)"
      @toggle-completed="emit('toggle-completed', $event)"
    >
      <template #title-extra>
        <button
          v-if="editable && !selectionMode"
          type="button"
          class="training-detail-note-button"
          :class="{ 'has-note': item.note, 'is-active': noteActive }"
          :title="item.note ? '编辑备注' : '添加备注'"
          :aria-label="`${item.note ? '编辑' : '添加'}题目 ${item.problemId} 的备注`"
          :aria-expanded="noteActive"
          :aria-controls="noteActive ? 'training-note-workspace' : undefined"
          @click="emit('edit-note')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.5 4.5h13v12h-8l-4.5 3v-3h-.5z" />
            <path d="M8.5 8h7M8.5 11.5h5" />
          </svg>
          <span v-if="item.note" aria-hidden="true"></span>
        </button>
      </template>
    </ProblemListItem>

    <div v-else-if="viewMode === 'list-view'" class="training-missing-list-row" role="status">
      <label v-if="editable && selectionMode" class="bank-result-problem-select">
        <input
          class="bank-result-problem-select-checkbox"
          type="checkbox"
          :checked="selected"
          :aria-label="`选择题目 ${item.problemId}`"
          @change="emit('selection-change', $event.target.checked)"
        />
      </label>
      <button
        v-else-if="editable"
        class="bank-result-problem-drag-handle"
        type="button"
        draggable="true"
        :aria-label="`拖动排序题目 ${item.problemId}；也可使用上下方向键调整`"
        @click.prevent
        @dragstart="emit('drag-start', $event)"
        @dragend="emit('drag-end')"
        @keydown.up.prevent="moveBy(-1)"
        @keydown.down.prevent="moveBy(1)"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <button
        type="button"
        class="bank-result-problem-panel-view-item-status is-toggle"
        :class="{ 'is-complete': completed }"
        :aria-label="`${completed ? '标记为未做' : '标记为已做'}：${item.problemId}`"
        :aria-pressed="completed"
        :title="completed ? '标记为未做' : '标记为已做'"
        @click="emit('toggle-completed', !completed)"
      >
        {{ completed ? '✓' : '' }}
      </button>
      <div>
        <div class="training-missing-list-heading">
          <strong>{{ item.problemId }}</strong>
          <button
            v-if="editable && !selectionMode"
            type="button"
            class="training-detail-note-button"
            :class="{ 'has-note': item.note, 'is-active': noteActive }"
            :title="item.note ? '编辑备注' : '添加备注'"
            :aria-label="`${item.note ? '编辑' : '添加'}题目 ${item.problemId} 的备注`"
            :aria-expanded="noteActive"
            :aria-controls="noteActive ? 'training-note-workspace' : undefined"
            @click="emit('edit-note')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5.5 4.5h13v12h-8l-4.5 3v-3h-.5z" />
              <path d="M8.5 8h7M8.5 11.5h5" />
            </svg>
            <span v-if="item.note" aria-hidden="true"></span>
          </button>
        </div>
        <span>题目数据暂不可用，题号与备注仍会保留。</span>
      </div>
      <button
        v-if="editable && !selectionMode"
        class="bank-result-problem-remove"
        type="button"
        :aria-label="`从题单移除题目 ${item.problemId}`"
        @click="emit('remove')"
      >
        ×
      </button>
    </div>

    <section v-else class="training-exam-problem is-missing" role="status">
      <div class="training-exam-problem-row">
        <strong>【题目】</strong>
        <span>{{ index + 1 }}.</span>
        <p>题号 {{ item.problemId }} 的题目数据暂不可用，题号与备注仍会保留。</p>
      </div>
    </section>
  </article>
</template>
