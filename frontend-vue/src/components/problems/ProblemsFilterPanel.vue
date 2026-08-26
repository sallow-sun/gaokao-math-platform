<script setup>
import { ref, watch } from 'vue'
import ProblemsFilterGroup from './ProblemsFilterGroup.vue'

const props = defineProps({
  filterMode: {
    type: String,
    required: true,
  },
  keyword: {
    type: String,
    default: '',
  },
  level: {
    type: [String, Array],
    default: '',
  },
  levelOptions: {
    type: Array,
    required: true,
  },
  questionType: {
    type: [String, Array],
    default: '',
  },
  source: {
    type: [String, Array],
    default: '',
  },
  sourceCatalogOptions: {
    type: Array,
    required: true,
  },
  sourceOptions: {
    type: Array,
    required: true,
  },
  sourcePinnedValues: {
    type: Array,
    required: true,
  },
  typeCatalogOptions: {
    type: Array,
    required: true,
  },
  typeOptions: {
    type: Array,
    required: true,
  },
  typePinnedValues: {
    type: Array,
    required: true,
  },
  year: {
    type: [String, Array],
    default: '',
  },
  yearCatalogOptions: {
    type: Array,
    required: true,
  },
  yearOptions: {
    type: Array,
    required: true,
  },
  yearPinnedValues: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits([
  'search',
  'clear',
  'filter-mode-change',
  'level-change',
  'source-change',
  'source-pin-change',
  'type-change',
  'type-pin-change',
  'year-change',
  'year-pin-change',
])
const draftKeyword = ref(props.keyword)

watch(
  () => props.keyword,
  (keyword) => {
    draftKeyword.value = keyword
  },
)

function submitSearch() {
  emit('search', draftKeyword.value.trim())
}

function clearSearch() {
  draftKeyword.value = ''
  emit('clear')
}

function updateFilterMode(event) {
  emit('filter-mode-change', event.target.checked ? 'multiple' : 'single')
}
</script>

<template>
  <section class="bank-filter-panel" aria-labelledby="bank-filter-panel-title">
    <header class="bank-filter-panel-header">
      <h2 id="bank-filter-panel-title">筛选</h2>

      <div class="bank-filter-header-actions">
        <label class="bank-filter-multiple-control">
          <span class="bank-filter-multiple-label">允许多选</span>
          <input
            class="bank-filter-multiple-input"
            type="checkbox"
            role="switch"
            :checked="filterMode === 'multiple'"
            :aria-checked="filterMode === 'multiple'"
            aria-label="允许同一筛选行选择多个条件"
            :title="
              filterMode === 'multiple'
                ? '已允许同一筛选行选择多个条件'
                : '开启后，同一筛选行可以选择多个条件'
            "
            @change="updateFilterMode"
          />
          <span class="bank-filter-multiple-switch" aria-hidden="true"></span>
        </label>

        <button class="bank-filter-clear" type="reset" form="problem-bank-filter-form">
          清除全部
        </button>
      </div>
    </header>

    <form
      id="problem-bank-filter-form"
      class="bank-filter-panel-form"
      role="search"
      :data-filter-mode="filterMode"
      @submit.prevent="submitSearch"
      @reset.prevent="clearSearch"
    >
      <ProblemsFilterGroup
        filter-key="year"
        label="年份"
        :model-value="year"
        :multiple="filterMode === 'multiple'"
        :more-options="yearCatalogOptions"
        :options="yearOptions"
        :pinned-values="yearPinnedValues"
        pinnable
        popover-title="所有年份"
        @pin-change="emit('year-pin-change', $event)"
        @select="emit('year-change', $event)"
      />

      <ProblemsFilterGroup
        filter-key="source"
        label="来源"
        :model-value="source"
        :multiple="filterMode === 'multiple'"
        :more-options="sourceCatalogOptions"
        :options="sourceOptions"
        :pinned-values="sourcePinnedValues"
        pinnable
        popover-title="所有来源"
        @pin-change="emit('source-pin-change', $event)"
        @select="emit('source-change', $event)"
      />

      <ProblemsFilterGroup
        filter-key="type"
        label="题型"
        :model-value="questionType"
        :multiple="filterMode === 'multiple'"
        :more-options="typeCatalogOptions"
        :options="typeOptions"
        :pinned-values="typePinnedValues"
        pinnable
        popover-title="所有题型"
        @pin-change="emit('type-pin-change', $event)"
        @select="emit('type-change', $event)"
      />

      <ProblemsFilterGroup
        filter-key="level"
        label="题目难度"
        :model-value="level"
        :multiple="filterMode === 'multiple'"
        :options="levelOptions"
        colorized
        @select="emit('level-change', $event)"
      />

      <div class="bank-filter-search-row">
        <div class="bank-filter-panel-item bank-filter-keyword">
          <label for="problems-keyword">关键词</label>
          <input
            id="problems-keyword"
            v-model="draftKeyword"
            type="search"
            name="keyword"
            placeholder="搜索题号、来源或知识点"
            autocomplete="off"
          />
        </div>

        <button class="bank-filter-submit" type="submit">查找题目</button>
      </div>
    </form>
  </section>
</template>
