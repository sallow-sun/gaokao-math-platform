<script setup>
import ProblemsPersonalizationSettings from './ProblemsPersonalizationSettings.vue'

defineProps({
  actionConfirmations: {
    type: Object,
    required: true,
  },
  displayOptions: {
    type: Object,
    required: true,
  },
  displayOptionOptions: {
    type: Array,
    required: true,
  },
  printOptionOptions: {
    type: Array,
    required: true,
  },
  printOptions: {
    type: Object,
    required: true,
  },
  sort: {
    type: String,
    required: true,
  },
  sortOptions: {
    type: Array,
    required: true,
  },
  totalCount: {
    type: [Number, String],
    default: '—',
  },
  viewMode: {
    type: String,
    required: true,
  },
})

const emit = defineEmits([
  'display-option-change',
  'display-options-all',
  'display-options-minimal',
  'action-confirmation-change',
  'print-option-change',
  'print-preset-change',
  'sort-change',
  'view-mode-change',
])

function handleSortChange(event) {
  emit('sort-change', event.target.value)
}
</script>

<template>
  <header class="bank-result-toolbar-panel">
    <div class="bank-result-heading">
      <h2 id="bank-result-title">筛选结果</h2>
      <p>
        共 <strong id="problem-count">{{ totalCount }}</strong> 道题目
      </p>
    </div>

    <div class="bank-result-toolbar-controls">
      <ProblemsPersonalizationSettings
        :action-confirmations="actionConfirmations"
        :display-options="displayOptions"
        :display-option-options="displayOptionOptions"
        :print-option-options="printOptionOptions"
        :print-options="printOptions"
        @action-confirmation-change="emit('action-confirmation-change', $event)"
        @display-option-change="emit('display-option-change', $event)"
        @display-options-all="emit('display-options-all')"
        @display-options-minimal="emit('display-options-minimal')"
        @print-option-change="emit('print-option-change', $event)"
        @print-preset-change="emit('print-preset-change', $event)"
      />

      <div class="bank-header-view-switch" aria-label="题目展示方式">
        <button
          type="button"
          class="bank-header-view-switch-button"
          :class="{ 'is-active': viewMode === 'preview-view' }"
          :aria-pressed="viewMode === 'preview-view'"
          @click="emit('view-mode-change', 'preview-view')"
        >
          完整
        </button>
        <button
          type="button"
          class="bank-header-view-switch-button"
          :class="{ 'is-active': viewMode === 'list-view' }"
          :aria-pressed="viewMode === 'list-view'"
          @click="emit('view-mode-change', 'list-view')"
        >
          简略
        </button>
      </div>

      <label class="bank-sort-control" for="sort-order">
        <span>按</span>
        <select id="sort-order" :value="sort" name="sort-order" @change="handleSortChange">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <span>排序</span>
      </label>
    </div>
  </header>
</template>
