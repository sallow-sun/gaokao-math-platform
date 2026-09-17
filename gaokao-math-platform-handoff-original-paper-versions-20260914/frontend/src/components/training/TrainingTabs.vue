<script setup>
import { ref } from 'vue'

const props = defineProps({
  activeTab: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['change'])
const tabButtons = ref([])
const tabs = [
  { value: 'official', label: '官方题单' },
  { value: 'square', label: '题单广场' },
  { value: 'mine', label: '我的题单' },
]

function setTabButton(element, index) {
  if (element) {
    tabButtons.value[index] = element
  }
}

function selectTab(tab, index) {
  emit('change', tab.value)
  tabButtons.value[index]?.focus()
}

function handleTabKeydown(event, index) {
  let nextIndex

  if (event.key === 'ArrowRight') {
    nextIndex = (index + 1) % tabs.length
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (index - 1 + tabs.length) % tabs.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = tabs.length - 1
  } else {
    return
  }

  event.preventDefault()
  selectTab(tabs[nextIndex], nextIndex)
}
</script>

<template>
  <nav class="training-main-tabs" role="tablist" aria-label="题单分类">
    <button
      v-for="(tab, index) in tabs"
      :id="`training-tab-${tab.value}`"
      :key="tab.value"
      :ref="(element) => setTabButton(element, index)"
      class="training-main-tab"
      :class="{ 'is-active': props.activeTab === tab.value }"
      type="button"
      role="tab"
      :aria-selected="props.activeTab === tab.value"
      :aria-controls="`training-panel-${tab.value}`"
      :tabindex="props.activeTab === tab.value ? 0 : -1"
      @click="selectTab(tab, index)"
      @keydown="handleTabKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>
