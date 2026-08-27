<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['cancel', 'create'])
const title = ref('')
const description = ref('')
const validationMessage = ref('')
const titleInput = ref(null)
const submitButton = ref(null)
let previouslyFocusedElement = null

function cancel() {
  emit('cancel')
}

function submit() {
  const normalizedTitle = title.value.trim()

  if (!normalizedTitle) {
    validationMessage.value = '请输入题单名称'
    titleInput.value?.focus()
    return
  }

  emit('create', {
    title: normalizedTitle,
    description: description.value.trim(),
  })
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

  if (event.shiftKey && document.activeElement === titleInput.value) {
    event.preventDefault()
    submitButton.value?.focus()
  } else if (!event.shiftKey && document.activeElement === submitButton.value) {
    event.preventDefault()
    titleInput.value?.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocusedElement = document.activeElement
      title.value = ''
      description.value = ''
      validationMessage.value = ''
      document.addEventListener('keydown', handleKeydown)
      await nextTick()
      titleInput.value?.focus()
      return
    }

    document.removeEventListener('keydown', handleKeydown)
    previouslyFocusedElement?.focus?.()
    previouslyFocusedElement = null
  },
)

watch(title, () => {
  if (validationMessage.value && title.value.trim()) {
    validationMessage.value = ''
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="training-dialog">
      <div v-if="open" class="training-dialog-backdrop" @mousedown.self="cancel">
        <section
          class="training-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="training-create-title"
          aria-describedby="training-create-description"
        >
          <header>
            <h2 id="training-create-title">创建题单</h2>
            <p id="training-create-description">题单目前保存在此浏览器中，可以随时继续整理。</p>
          </header>

          <form @submit.prevent="submit">
            <label for="training-list-title">题单名称</label>
            <input
              id="training-list-title"
              ref="titleInput"
              v-model="title"
              type="text"
              autocomplete="off"
              :aria-invalid="Boolean(validationMessage)"
              :aria-describedby="validationMessage ? 'training-list-title-error' : undefined"
            />
            <p v-if="validationMessage" id="training-list-title-error" class="training-form-error">
              {{ validationMessage }}
            </p>

            <label for="training-list-description">说明（可选）</label>
            <textarea
              id="training-list-description"
              v-model="description"
              rows="4"
              placeholder="例如：一轮复习中的函数与导数易错题"
            ></textarea>

            <div class="training-dialog-actions">
              <button type="button" @click="cancel">取消</button>
              <button ref="submitButton" class="is-primary" type="submit">创建题单</button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
