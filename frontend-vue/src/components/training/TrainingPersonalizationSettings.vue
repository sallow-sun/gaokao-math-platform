<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  includeNotes: {
    type: Boolean,
    default: true,
  },
  includePrintHeader: {
    type: Boolean,
    default: false,
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
  'include-notes-change',
  'include-print-header-change',
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
      'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
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
  <div class="bank-personalization-settings training-personalization-settings">
    <button
      ref="settingsToggle"
      class="bank-display-filter-toggle bank-personalization-settings-toggle"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="training-personalization-settings-dialog"
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
            id="training-personalization-settings-dialog"
            ref="dialog"
            class="bank-personalization-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-personalization-settings-title"
            aria-describedby="training-personalization-settings-description"
          >
            <header class="bank-personalization-dialog-header">
              <div>
                <h2 id="training-personalization-settings-title">题单个性化设置</h2>
                <p id="training-personalization-settings-description">
                  调整单题和整份题单打印时包含的内容。
                </p>
              </div>
              <button type="button" aria-label="关闭题单个性化设置" @click="close(true)">×</button>
            </header>

            <div class="bank-personalization-dialog-body">
              <section
                class="bank-personalization-section"
                aria-labelledby="training-print-options-title"
              >
                <header>
                  <div>
                    <h3 id="training-print-options-title">打印内容</h3>
                    <p>题单序号用于当前试卷顺序；“题库编号”指 P10001 这类编号。</p>
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

              <section
                class="bank-personalization-section"
                aria-labelledby="training-output-notes-title"
              >
                <header>
                  <div>
                    <h3 id="training-output-notes-title">题单附加内容</h3>
                    <p>页眉默认关闭；个人备注不会出现在“复制题号”的内容中。</p>
                  </div>
                </header>

                <div class="bank-display-filter-options training-personalization-output-options">
                  <label>
                    <input
                      type="checkbox"
                      :checked="includePrintHeader"
                      @change="emit('include-print-header-change', $event.target.checked)"
                    />
                    <span>显示题单页眉</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      :checked="includeNotes"
                      @change="emit('include-notes-change', $event.target.checked)"
                    />
                    <span>打印包含个人备注</span>
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
