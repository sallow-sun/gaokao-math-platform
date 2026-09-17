<script setup>
import { computed } from 'vue'

const props = defineProps({
  includeHeader: {
    type: Boolean,
    default: false,
  },
  includeNotes: {
    type: Boolean,
    default: undefined,
  },
  options: {
    type: Object,
    required: true,
  },
  optionOptions: {
    type: Array,
    required: true,
  },
  pageLayout: {
    type: String,
    default: 'auto',
  },
  pageLayoutOptions: {
    type: Array,
    required: true,
  },
  showNotesOption: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'include-header-change',
  'include-notes-change',
  'option-change',
  'page-layout-change',
  'preset-change',
])
const selectedOptionCount = computed(
  () => props.optionOptions.filter((option) => props.options[option.value]).length,
)
</script>

<template>
  <section class="bank-personalization-section" aria-labelledby="shared-print-options-title">
    <header>
      <div><h3 id="shared-print-options-title">打印内容</h3></div>
      <span class="bank-personalization-count">
        {{ selectedOptionCount }} / {{ optionOptions.length }} 项
      </span>
    </header>

    <div class="bank-display-filter-options">
      <label v-for="option in optionOptions" :key="option.value">
        <input
          type="checkbox"
          :checked="options[option.value]"
          @change="emit('option-change', { name: option.value, visible: $event.target.checked })"
        />
        <span>{{ option.label }}</span>
      </label>
    </div>

    <footer class="bank-personalization-section-footer">
      <button type="button" @click="emit('preset-change', 'practice-paper')">仅题型、题干</button>
      <button type="button" @click="emit('preset-change', 'all')">全部内容</button>
    </footer>
  </section>

  <section class="bank-personalization-section" aria-labelledby="shared-print-layout-title">
    <header>
      <div><h3 id="shared-print-layout-title">打印版式</h3></div>
    </header>
    <div class="bank-display-filter-options problem-personalization-output-options">
      <fieldset class="problem-personalization-page-layout">
        <legend>每页题量</legend>
        <label v-for="option in pageLayoutOptions" :key="option.value">
          <input
            type="radio"
            name="shared-print-page-layout"
            :value="option.value"
            :checked="pageLayout === option.value"
            @change="emit('page-layout-change', option.value)"
          />
          <span>{{ option.label }}</span>
        </label>
      </fieldset>
      <label>
        <input
          type="checkbox"
          :checked="includeHeader"
          @change="emit('include-header-change', $event.target.checked)"
        />
        <span>显示练习页眉</span>
      </label>
      <label v-if="showNotesOption">
        <input
          type="checkbox"
          :checked="includeNotes"
          @change="emit('include-notes-change', $event.target.checked)"
        />
        <span>打印包含个人备注</span>
      </label>
    </div>
  </section>
</template>
