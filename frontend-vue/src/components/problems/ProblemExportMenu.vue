<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['export'])
const exportMenu = ref(null)
const exportToggle = ref(null)
const isOpen = ref(false)

function close(shouldRestoreFocus = false) {
  isOpen.value = false

  if (shouldRestoreFocus) {
    exportToggle.value?.focus()
  }
}

async function toggle() {
  isOpen.value = !isOpen.value

  if (isOpen.value) {
    await nextTick()
    exportMenu.value?.querySelector('[role="menuitem"]')?.focus()
  }
}

function selectFormat(format) {
  close()
  emit('export', format)
}

function handlePointerDown(event) {
  if (isOpen.value && !exportMenu.value?.contains(event.target)) {
    close()
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    close(true)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div ref="exportMenu" class="bank-problem-export">
    <button ref="exportToggle" type="button" :aria-expanded="isOpen" @click="toggle">导出</button>

    <div v-show="isOpen" class="bank-problem-export-menu" role="menu">
      <button type="button" role="menuitem" @click="selectFormat('pdf')">导出为 PDF</button>
      <button type="button" role="menuitem" @click="selectFormat('image')">
        导出为图片（PNG）
      </button>
      <button type="button" role="menuitem" @click="selectFormat('markdown')">
        复制为 Markdown
      </button>
      <button type="button" role="menuitem" @click="selectFormat('latex')">复制为 LaTeX</button>
      <button type="button" role="menuitem" @click="selectFormat('text')">复制为纯文本</button>
    </div>
  </div>
</template>
