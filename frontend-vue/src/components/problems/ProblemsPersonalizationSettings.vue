<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  actionConfirmations: {
    type: Object,
    required: true,
  },
  displayOptions: {
    type: Object,
    required: true,
  },
  displayOptionOptions: {
    type: Array,
    required: true,
  },
  printOptions: {
    type: Object,
    required: true,
  },
  printOptionOptions: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits([
  'action-confirmation-change',
  'display-option-change',
  'display-options-all',
  'display-options-minimal',
  'print-option-change',
  'print-preset-change',
])
const dialog = ref(null)
const settingsToggle = ref(null)
const isOpen = ref(false)
const selectedPrintOptionCount = computed(
  () => props.printOptionOptions.filter((option) => props.printOptions[option.value]).length,
)
let bodyOverflowBeforeOpen = ''

const actionConfirmationOptions = [
  {
    value: 'markCompleted',
    label: '标记已做时确认',
    description: '从未做改为已做前询问',
  },
  {
    value: 'unmarkCompleted',
    label: '取消已做时确认',
    description: '从已做恢复为未做前询问',
  },
  {
    value: 'addFavorite',
    label: '加入收藏时确认',
    description: '收藏题目前询问',
  },
  {
    value: 'removeFavorite',
    label: '移出收藏时确认',
    description: '移出收藏前询问',
  },
]

function close(shouldRestoreFocus = false) {
  isOpen.value = false

  if (shouldRestoreFocus) {
    settingsToggle.value?.focus()
  }
}

function open() {
  isOpen.value = true
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

  if (focusableElements.length === 0) {
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)

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
    dialog.value?.querySelector('input')?.focus()
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
      class="bank-display-filter-toggle bank-personalization-settings-toggle"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="bank-personalization-settings-dialog"
      @click="open"
    >
      个性化设置
    </button>

    <Teleport to="body">
      <Transition name="bank-personalization-dialog">
        <div
          v-if="isOpen"
          class="bank-personalization-dialog-backdrop"
          @mousedown.self="close(true)"
        >
          <section
            id="bank-personalization-settings-dialog"
            ref="dialog"
            class="bank-personalization-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-personalization-settings-title"
            aria-describedby="bank-personalization-settings-description"
          >
            <header class="bank-personalization-dialog-header">
              <div>
                <h2 id="bank-personalization-settings-title">个性化设置</h2>
                <p id="bank-personalization-settings-description">
                  统一调整题库显示、打印内容和操作确认。
                </p>
              </div>
              <button type="button" aria-label="关闭个性化设置" @click="close(true)">×</button>
            </header>

            <div class="bank-personalization-dialog-body">
              <section class="bank-personalization-section" aria-labelledby="display-options-title">
                <header>
                  <div>
                    <h3 id="display-options-title">页面显示</h3>
                    <p>这些选项应用于完整视图。</p>
                  </div>
                </header>

                <div class="bank-display-filter-options">
                  <label v-for="option in displayOptionOptions" :key="option.value">
                    <input
                      type="checkbox"
                      :checked="displayOptions[option.value]"
                      @change="
                        emit('display-option-change', {
                          name: option.value,
                          visible: $event.target.checked,
                        })
                      "
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>

                <footer class="bank-personalization-section-footer">
                  <button type="button" @click="emit('display-options-minimal')">全部隐藏</button>
                  <button type="button" @click="emit('display-options-all')">全部显示</button>
                </footer>
              </section>

              <section class="bank-personalization-section" aria-labelledby="print-options-title">
                <header>
                  <div>
                    <h3 id="print-options-title">打印内容</h3>
                    <p>单题、批量打印和 PDF 共用。</p>
                  </div>
                  <span class="bank-personalization-count">
                    {{ selectedPrintOptionCount }} / {{ printOptionOptions.length }} 项
                  </span>
                </header>

                <div class="bank-display-filter-options">
                  <label v-for="option in printOptionOptions" :key="option.value">
                    <input
                      type="checkbox"
                      :checked="printOptions[option.value]"
                      @change="
                        emit('print-option-change', {
                          name: option.value,
                          visible: $event.target.checked,
                        })
                      "
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>

                <footer class="bank-personalization-section-footer">
                  <button type="button" @click="emit('print-preset-change', 'practice-paper')">
                    仅题型、题干
                  </button>
                  <button type="button" @click="emit('print-preset-change', 'all')">
                    全部内容
                  </button>
                </footer>
              </section>

              <section class="bank-personalization-section" aria-labelledby="action-options-title">
                <header>
                  <div>
                    <h3 id="action-options-title">操作确认</h3>
                    <p>开启后，对应操作执行前会弹窗二次确认。</p>
                  </div>
                </header>

                <div class="bank-action-confirmation-options">
                  <label v-for="option in actionConfirmationOptions" :key="option.value">
                    <input
                      type="checkbox"
                      :checked="actionConfirmations[option.value]"
                      @change="
                        emit('action-confirmation-change', {
                          name: option.value,
                          enabled: $event.target.checked,
                        })
                      "
                    />
                    <span>
                      <strong>{{ option.label }}</strong>
                      <small>{{ option.description }}</small>
                    </span>
                  </label>
                </div>
              </section>
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
