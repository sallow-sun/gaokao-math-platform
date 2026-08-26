<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { PROBLEMS_ACTION_CONFIRMATION_OPTIONS } from '../../composables/useProblemsActionPreferences.js'

const props = defineProps({
  actionConfirmations: {
    type: Object,
    required: true,
  },
  answerPlacement: {
    type: String,
    required: true,
  },
  answerPlacementOptions: {
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
  typeColorMode: {
    type: String,
    required: true,
  },
  typeColorOptions: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits([
  'action-confirmation-change',
  'answer-placement-change',
  'print-option-change',
  'print-preset-change',
  'type-color-change',
])
const dialog = ref(null)
const isOpen = ref(false)
const settingsToggle = ref(null)
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
  <div class="question-personalization-settings">
    <button
      ref="settingsToggle"
      type="button"
      class="question-personalization-toggle"
      :aria-expanded="isOpen"
      aria-controls="question-personalization-dialog"
      @click="isOpen = true"
    >
      个性化
    </button>

    <Teleport to="body">
      <Transition name="question-personalization-dialog">
        <div v-if="isOpen" class="question-personalization-backdrop" @mousedown.self="close(true)">
          <section
            id="question-personalization-dialog"
            ref="dialog"
            class="question-personalization-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-personalization-title"
            aria-describedby="question-personalization-description"
          >
            <header class="question-personalization-header">
              <div>
                <h2 id="question-personalization-title">个性化设置</h2>
                <p id="question-personalization-description">调整单题页面显示和打印内容。</p>
              </div>
              <button type="button" aria-label="关闭个性化设置" @click="close(true)">×</button>
            </header>

            <div class="question-personalization-body">
              <section aria-labelledby="question-answer-placement-title">
                <header>
                  <h3 id="question-answer-placement-title">答案解析位置</h3>
                  <p>默认显示在右侧栏，也可以移动到草稿区下方。</p>
                </header>
                <div class="question-personalization-options">
                  <label v-for="option in answerPlacementOptions" :key="option.value">
                    <input
                      type="radio"
                      name="question-answer-placement"
                      :value="option.value"
                      :checked="answerPlacement === option.value"
                      @change="emit('answer-placement-change', option.value)"
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>
              </section>

              <section aria-labelledby="question-type-color-title">
                <header>
                  <h3 id="question-type-color-title">题型颜色</h3>
                  <p>控制顶栏题型文字的颜色。</p>
                </header>
                <div class="question-personalization-options">
                  <label v-for="option in typeColorOptions" :key="option.value">
                    <input
                      type="radio"
                      name="question-type-color"
                      :value="option.value"
                      :checked="typeColorMode === option.value"
                      @change="emit('type-color-change', option.value)"
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>
              </section>

              <section aria-labelledby="question-print-options-title">
                <header class="question-personalization-section-heading">
                  <div>
                    <h3 id="question-print-options-title">打印内容</h3>
                    <p>打印和导出 PDF 共用这些选项。</p>
                  </div>
                  <span>{{ selectedPrintOptionCount }} / {{ printOptionOptions.length }} 项</span>
                </header>
                <div class="question-personalization-options question-print-options">
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
                <footer class="question-personalization-section-footer">
                  <button type="button" @click="emit('print-preset-change', 'practice-paper')">
                    仅题型、题干
                  </button>
                  <button type="button" @click="emit('print-preset-change', 'all')">
                    全部内容
                  </button>
                </footer>
              </section>

              <section aria-labelledby="question-action-options-title">
                <header>
                  <h3 id="question-action-options-title">操作确认</h3>
                  <p>开启后，对应操作执行前会弹窗二次确认。</p>
                </header>
                <div class="question-action-confirmation-options">
                  <label v-for="option in PROBLEMS_ACTION_CONFIRMATION_OPTIONS" :key="option.value">
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

            <footer class="question-personalization-footer">
              <p>设置仅保存在当前浏览器。</p>
              <button type="button" @click="close(true)">完成</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
