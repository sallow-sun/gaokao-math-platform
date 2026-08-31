<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  description: {
    type: String,
    default: '',
  },
  dialogId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: '个性化设置',
  },
  toggleAriaLabel: {
    type: String,
    default: '打开个性化设置',
  },
  toggleClass: {
    type: [String, Array, Object],
    default: '',
  },
  toggleTitle: {
    type: String,
    default: '个性化设置',
  },
})

const dialog = ref(null)
const isOpen = ref(false)
const settingsToggle = ref(null)
let bodyOverflowBeforeOpen = ''

const titleId = `${props.dialogId}-title`
const descriptionId = `${props.dialogId}-description`

function close(restoreFocus = false) {
  isOpen.value = false

  if (restoreFocus) {
    settingsToggle.value?.focus()
  }
}

function handleKeydown(event) {
  if (!isOpen.value) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const focusableElements = Array.from(
    dialog.value?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  )
  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)

  if (!firstElement || !lastElement) {
    return
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

watch(isOpen, async (openState) => {
  if (openState) {
    bodyOverflowBeforeOpen = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown)
    await nextTick()
    dialog.value?.querySelector('input, button')?.focus()
    return
  }

  document.body.style.overflow = bodyOverflowBeforeOpen
  document.removeEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.body.style.overflow = bodyOverflowBeforeOpen
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="bank-personalization-settings">
    <button
      ref="settingsToggle"
      type="button"
      class="bank-display-filter-toggle bank-personalization-settings-toggle"
      :class="toggleClass"
      :aria-controls="dialogId"
      :aria-expanded="isOpen"
      :aria-label="toggleAriaLabel"
      :title="toggleTitle"
      @click="isOpen = true"
    >
      <slot name="toggle">个性化设置</slot>
    </button>

    <Teleport to="body">
      <Transition name="bank-personalization-dialog">
        <div
          v-if="isOpen"
          class="bank-personalization-dialog-backdrop"
          @mousedown.self="close(true)"
        >
          <section
            :id="dialogId"
            ref="dialog"
            class="bank-personalization-dialog"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            :aria-describedby="description ? descriptionId : undefined"
          >
            <header class="bank-personalization-dialog-header">
              <div>
                <h2 :id="titleId">{{ title }}</h2>
                <p v-if="description" :id="descriptionId">{{ description }}</p>
              </div>
              <button type="button" aria-label="关闭个性化设置" @click="close(true)">×</button>
            </header>

            <div class="bank-personalization-dialog-body">
              <slot />
            </div>

            <footer class="bank-personalization-dialog-footer">
              <button type="button" @click="close(true)">完成</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
