<script setup>
import { ref, watchEffect } from 'vue'

const props = defineProps({
  allVisibleSelected: {
    type: Boolean,
    required: true,
  },
  selectedCount: {
    type: Number,
    required: true,
  },
  someVisibleSelected: {
    type: Boolean,
    required: true,
  },
  visibleCount: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['add-to-list', 'clear', 'print', 'select-all-change'])
const selectAllInput = ref(null)

watchEffect(() => {
  if (selectAllInput.value) {
    selectAllInput.value.indeterminate = props.someVisibleSelected && !props.allVisibleSelected
  }
})
</script>

<template>
  <aside class="bank-batch-selection-toolbar" aria-label="批量操作">
    <label class="bank-batch-selection-all">
      <input
        ref="selectAllInput"
        type="checkbox"
        :checked="allVisibleSelected"
        :disabled="visibleCount === 0"
        @change="emit('select-all-change', $event.target.checked)"
      />
      <span>全选已加载题目</span>
    </label>

    <p class="bank-batch-selection-count" aria-live="polite">
      已选择 <strong>{{ selectedCount }}</strong> 道题
    </p>

    <div class="bank-batch-selection-actions">
      <button type="button" @click="emit('print')">打印所选</button>
      <button type="button" class="is-primary" @click="emit('add-to-list')">加入题单</button>
      <button type="button" @click="emit('clear')">取消选择</button>
    </div>
  </aside>
</template>
