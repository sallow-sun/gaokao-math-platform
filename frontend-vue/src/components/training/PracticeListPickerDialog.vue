<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import '../../assets/styles/practice-list-picker.css'

const props = defineProps({
  defaultListId: {
    type: String,
    default: '',
  },
  lists: {
    type: Array,
    default: () => [],
  },
  mode: {
    type: String,
    default: 'manage',
    validator: (value) => ['add', 'manage'].includes(value),
  },
  open: {
    type: Boolean,
    default: false,
  },
  problemCount: {
    type: Number,
    default: 1,
  },
  selectedListIds: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['apply', 'cancel', 'create-list', 'selection-change'])
const dialogPanel = ref(null)
const closeButton = ref(null)
const creatingList = ref(false)
const newListTitle = ref('')
const newListDescription = ref('')
const creationError = ref('')
const newListTitleInput = ref(null)
let previouslyFocusedElement = null

const dialogTitle = computed(() =>
  props.mode === 'manage'
    ? props.selectedListIds.length
      ? '管理题单归属'
      : '选择题单'
    : `将 ${props.problemCount} 道题加入题单`,
)
const applyDisabled = computed(() => props.mode === 'add' && props.selectedListIds.length === 0)

function cancel() {
  emit('cancel')
}

function setListSelected(listId, selected) {
  emit('selection-change', { listId, selected })
}

async function showCreateForm() {
  creatingList.value = true
  creationError.value = ''
  await nextTick()
  newListTitleInput.value?.focus()
}

function hideCreateForm() {
  creatingList.value = false
  newListTitle.value = ''
  newListDescription.value = ''
  creationError.value = ''
}

function createPracticeList() {
  const title = newListTitle.value.trim()

  if (!title) {
    creationError.value = '请输入题单名称'
    newListTitleInput.value?.focus()
    return
  }

  emit('create-list', {
    title,
    description: newListDescription.value.trim(),
  })
  hideCreateForm()
}

function getFocusableElements() {
  if (!dialogPanel.value) {
    return []
  }

  return Array.from(
    dialogPanel.value.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
    ),
  )
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

  const focusableElements = getFocusableElements()
  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)

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
      hideCreateForm()
      document.addEventListener('keydown', handleKeydown)
      await nextTick()
      closeButton.value?.focus()
      return
    }

    document.removeEventListener('keydown', handleKeydown)
    previouslyFocusedElement?.focus?.()
    previouslyFocusedElement = null
  },
)

watch(newListTitle, () => {
  if (creationError.value && newListTitle.value.trim()) {
    creationError.value = ''
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="practice-list-picker">
      <div v-if="open" class="practice-list-picker-backdrop" @mousedown.self="cancel">
        <section
          ref="dialogPanel"
          class="practice-list-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="practice-list-picker-title"
          aria-describedby="practice-list-picker-description"
        >
          <header class="practice-list-picker-header">
            <div>
              <h2 id="practice-list-picker-title">{{ dialogTitle }}</h2>
              <p id="practice-list-picker-description">
                <template v-if="mode === 'manage'">
                  勾选题单后保存；取消勾选会移除该题在对应题单中的备注。
                </template>
                <template v-else>选择一份或多份题单，不会移除题目已有的题单归属。</template>
              </p>
            </div>
            <button ref="closeButton" type="button" aria-label="关闭题单选择" @click="cancel">
              ×
            </button>
          </header>

          <div v-if="lists.length" class="practice-list-picker-options">
            <label v-for="practiceList in lists" :key="practiceList.id">
              <input
                type="checkbox"
                :checked="selectedListIds.includes(practiceList.id)"
                @change="setListSelected(practiceList.id, $event.target.checked)"
              />
              <span class="practice-list-picker-option-copy">
                <strong>
                  {{ practiceList.title }}
                  <small v-if="practiceList.id === defaultListId">默认</small>
                </strong>
                <span>{{ practiceList.items.length }} 题</span>
              </span>
            </label>
          </div>

          <div v-else class="practice-list-picker-empty">
            <p>还没有可用的个人题单，请先创建一份。</p>
          </div>

          <div class="practice-list-picker-create">
            <button v-if="!creatingList" type="button" @click="showCreateForm">＋ 新建题单</button>

            <form v-else @submit.prevent="createPracticeList">
              <label for="practice-list-picker-new-title">题单名称</label>
              <input
                id="practice-list-picker-new-title"
                ref="newListTitleInput"
                v-model="newListTitle"
                type="text"
                autocomplete="off"
                :aria-invalid="Boolean(creationError)"
                :aria-describedby="creationError ? 'practice-list-picker-create-error' : undefined"
              />
              <p
                v-if="creationError"
                id="practice-list-picker-create-error"
                class="practice-list-picker-error"
              >
                {{ creationError }}
              </p>

              <label for="practice-list-picker-new-description">说明（可选）</label>
              <textarea
                id="practice-list-picker-new-description"
                v-model="newListDescription"
                rows="2"
              ></textarea>

              <div class="practice-list-picker-create-actions">
                <button type="button" @click="hideCreateForm">取消新建</button>
                <button type="submit" class="is-primary">创建并选中</button>
              </div>
            </form>
          </div>

          <footer class="practice-list-picker-footer">
            <p aria-live="polite">已选择 {{ selectedListIds.length }} 份题单</p>
            <div>
              <button type="button" @click="cancel">取消</button>
              <button
                type="button"
                class="is-primary"
                :disabled="applyDisabled"
                @click="emit('apply')"
              >
                {{ mode === 'manage' ? '保存归属' : '加入所选题单' }}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
