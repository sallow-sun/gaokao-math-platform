<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  practiceList: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['cancel', 'save'])
const title = ref('')
const description = ref('')
const isPublic = ref(true)
const validationMessage = ref('')
const titleInput = ref(null)
const saveButton = ref(null)
let previouslyFocusedElement = null

function cancel() {
  emit('cancel')
}

function save() {
  const normalizedTitle = title.value.trim()

  if (!normalizedTitle) {
    validationMessage.value = '请输入题单名称'
    titleInput.value?.focus()
    return
  }

  emit('save', {
    title: normalizedTitle,
    description: description.value.trim(),
    isPublic: isPublic.value,
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
    saveButton.value?.focus()
  } else if (!event.shiftKey && document.activeElement === saveButton.value) {
    event.preventDefault()
    titleInput.value?.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocusedElement = document.activeElement
      title.value = props.practiceList?.title ?? ''
      description.value = props.practiceList?.description ?? ''
      isPublic.value = props.practiceList?.isPublic !== false
      validationMessage.value = ''
      document.addEventListener('keydown', handleKeydown)
      await nextTick()
      titleInput.value?.focus()
      titleInput.value?.select()
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
          aria-labelledby="training-edit-title"
          aria-describedby="training-edit-description"
        >
          <header>
            <h2 id="training-edit-title">编辑题单</h2>
            <p id="training-edit-description">修改题单名称和说明，不会影响其中的题目与备注。</p>
          </header>

          <form @submit.prevent="save">
            <label for="training-edit-list-title">题单名称</label>
            <input
              id="training-edit-list-title"
              ref="titleInput"
              v-model="title"
              type="text"
              autocomplete="off"
              :aria-invalid="Boolean(validationMessage)"
              :aria-describedby="validationMessage ? 'training-edit-title-error' : undefined"
            />
            <p v-if="validationMessage" id="training-edit-title-error" class="training-form-error">
              {{ validationMessage }}
            </p>

            <label for="training-edit-list-description">说明（可选）</label>
            <textarea id="training-edit-list-description" v-model="description" rows="4"></textarea>

            <label class="training-list-visibility-option">
              <input v-model="isPublic" type="checkbox" :disabled="practiceList?.isOfficial" />
              {{
                practiceList?.isOfficial
                  ? '官方题单始终公开，允许所有用户查看和打印'
                  : '公开题单，允许其他用户查看和打印'
              }}
            </label>

            <div class="training-dialog-actions">
              <button type="button" @click="cancel">取消</button>
              <button ref="saveButton" class="is-primary" type="submit">保存修改</button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
