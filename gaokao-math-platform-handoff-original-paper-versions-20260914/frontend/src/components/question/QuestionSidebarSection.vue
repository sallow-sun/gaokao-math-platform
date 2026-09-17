<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  collapsedText: {
    type: String,
    default: '查看内容',
  },
  defaultExpanded: {
    type: Boolean,
    default: false,
  },
  expandedText: {
    type: String,
    default: '收起内容',
  },
  headerActionHint: {
    type: String,
    default: '',
  },
  headerActionLabel: {
    type: String,
    default: '',
  },
  sectionId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
})

const isExpanded = ref(props.defaultExpanded)
const contentId = computed(() => `${props.sectionId}-content`)
const titleId = computed(() => `${props.sectionId}-title`)

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <section class="question-sidebar-section" :aria-labelledby="titleId">
    <header class="question-sidebar-section-header">
      <h2 :id="titleId">{{ title }}</h2>
      <button
        v-if="headerActionLabel"
        type="button"
        class="question-sidebar-link"
        :aria-label="`${headerActionLabel}（${headerActionHint}）`"
        :title="headerActionHint"
        disabled
      >
        {{ headerActionLabel }}
      </button>
    </header>

    <div
      :id="contentId"
      class="question-sidebar-content"
      role="region"
      :aria-labelledby="titleId"
      :hidden="!isExpanded"
    >
      <slot></slot>
    </div>

    <button
      class="question-sidebar-toggle"
      type="button"
      :aria-controls="contentId"
      :aria-expanded="isExpanded"
      @click="toggleExpanded"
    >
      <span class="question-sidebar-arrow" aria-hidden="true"></span>
      <span>{{ isExpanded ? expandedText : collapsedText }}</span>
    </button>
  </section>
</template>
