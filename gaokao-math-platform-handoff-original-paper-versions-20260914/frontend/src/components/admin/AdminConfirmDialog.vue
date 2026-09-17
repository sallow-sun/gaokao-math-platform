<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  busy: {
    type: Boolean,
    default: false,
  },
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
let previousFocus = null

function cancel() {
  if (!props.busy) {
    emit('cancel')
  }
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
      previousFocus = document.activeElement
      document.addEventListener('keydown', handleKeydown)
      await nextTick()
      cancelButton.value?.focus()
      return
    }

    document.removeEventListener('keydown', handleKeydown)
    previousFocus?.focus?.()
    previousFocus = null
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="admin-dialog">
      <div v-if="open" class="admin-dialog-backdrop" @mousedown.self="cancel">
        <section
          class="admin-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-dialog-title"
          aria-describedby="admin-dialog-description"
        >
          <h2 id="admin-dialog-title">{{ title }}</h2>
          <p id="admin-dialog-description">{{ description }}</p>
          <div class="admin-dialog-actions">
            <button ref="cancelButton" type="button" :disabled="busy" @click="cancel">取消</button>
            <button
              ref="confirmButton"
              type="button"
              class="is-danger"
              :disabled="busy"
              @click="emit('confirm')"
            >
              {{ busy ? '正在处理……' : confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
