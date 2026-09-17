<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  confirmLabel: {
    type: String,
    default: '确认',
  },
  description: {
    type: String,
    default: '',
  },
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['cancel', 'confirm'])
const cancelButton = ref(null)
const confirmButton = ref(null)
let previouslyFocusedElement = null

function cancel() {
  emit('cancel')
}

function handleKeydown(event) {
  if (!props.open) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const firstElement = cancelButton.value
  const lastElement = confirmButton.value

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement?.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement?.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocusedElement = document.activeElement
      document.addEventListener('keydown', handleKeydown)
      await nextTick()
      cancelButton.value?.focus()
      return
    }

    document.removeEventListener('keydown', handleKeydown)
    previouslyFocusedElement?.focus?.()
    previouslyFocusedElement = null
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="question-confirm-dialog">
      <div v-if="open" class="question-confirm-backdrop" @mousedown.self="cancel">
        <section
          class="question-confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="question-confirm-title"
          aria-describedby="question-confirm-description"
        >
          <h2 id="question-confirm-title">{{ title }}</h2>
          <p id="question-confirm-description">{{ description }}</p>
          <div class="question-confirm-actions">
            <button ref="cancelButton" type="button" @click="cancel">保留当前状态</button>
            <button ref="confirmButton" class="is-danger" type="button" @click="emit('confirm')">
              {{ confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
