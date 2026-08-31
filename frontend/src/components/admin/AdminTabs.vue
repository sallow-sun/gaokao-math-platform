<script setup>
import { nextTick, ref } from 'vue'

const props = defineProps({
  activeTab: {
    type: String,
    required: true,
  },
  tabs: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['change'])
const tabButtons = ref([])

function selectTab(tabKey) {
  emit('change', tabKey)
}

async function handleKeydown(event, index) {
  const lastIndex = props.tabs.length - 1
  let nextIndex

  if (event.key === 'ArrowRight') {
    nextIndex = index === lastIndex ? 0 : index + 1
  } else if (event.key === 'ArrowLeft') {
    nextIndex = index === 0 ? lastIndex : index - 1
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = lastIndex
  } else {
    return
  }

  event.preventDefault()
  selectTab(props.tabs[nextIndex].key)
  await nextTick()
  tabButtons.value[nextIndex]?.focus()
}
</script>

<template>
  <div class="admin-tabs" role="tablist" aria-label="管理功能">
    <button
      v-for="(tab, index) in tabs"
      :id="`admin-tab-${tab.key}`"
      :key="tab.key"
      ref="tabButtons"
      type="button"
      role="tab"
      :aria-controls="`admin-panel-${tab.key}`"
      :aria-selected="activeTab === tab.key"
      :class="['admin-tab', { 'is-active': activeTab === tab.key }]"
      :tabindex="activeTab === tab.key ? 0 : -1"
      @click="selectTab(tab.key)"
      @keydown="handleKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
