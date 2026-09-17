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

  if (event.shiftKey && document.activeElement === cancelButton.value) {
    event.preventDefault()
    confirmButton.value?.focus()
  } else if (!event.shiftKey && document.activeElement === confirmButton.value) {
    event.preventDefault()
    cancelButton.value?.focus()
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
    <Transition name="training-dialog">
      <div v-if="open" class="training-dialog-backdrop" @mousedown.self="cancel">
        <section
          class="training-dialog training-confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="training-confirm-title"
          aria-describedby="training-confirm-description"
        >
          <h2 id="training-confirm-title">{{ title }}</h2>
          <p id="training-confirm-description" class="training-confirm-description">
            {{ description }}
          </p>
          <div class="training-dialog-actions">
            <button ref="cancelButton" type="button" @click="cancel">取消</button>
            <button ref="confirmButton" class="is-danger" type="button" @click="emit('confirm')">
              {{ confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
