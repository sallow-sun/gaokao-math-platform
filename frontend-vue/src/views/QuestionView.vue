<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import QuestionAnswerSection from '../components/question/QuestionAnswerSection.vue'
import QuestionConfirmDialog from '../components/question/QuestionConfirmDialog.vue'
import QuestionForumPlaceholder from '../components/question/QuestionForumPlaceholder.vue'
import QuestionHeader from '../components/question/QuestionHeader.vue'
import QuestionHeaderTools from '../components/question/QuestionHeaderTools.vue'
import QuestionPersonalizationSettings from '../components/question/QuestionPersonalizationSettings.vue'
import QuestionPrintSheet from '../components/question/QuestionPrintSheet.vue'
import QuestionSidebar from '../components/question/QuestionSidebar.vue'
import QuestionStem from '../components/question/QuestionStem.vue'
import { copyProblem, exportProblemAsImage } from '../composables/useProblemExport.js'
import { useQuestionData } from '../composables/useQuestionData.js'
import {
  QUESTION_ANSWER_PLACEMENT_OPTIONS,
  QUESTION_PRINT_OPTION_OPTIONS,
  QUESTION_TYPE_COLOR_OPTIONS,
  useQuestionPreferences,
} from '../composables/useQuestionPreferences.js'
import { useProblemsActionPreferences } from '../composables/useProblemsActionPreferences.js'
import { useProblemsPracticeList } from '../composables/useProblemsPracticeList.js'
import { useProblemsUserMarks } from '../composables/useProblemsUserMarks.js'
import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'
import '../assets/styles/question.css'

const props = defineProps({
  problemNumber: {
    type: String,
    required: true,
  },
})

const routeProblemNumber = computed(() => props.problemNumber)
const { error, isLoading, normalizedProblemNumber, problem } = useQuestionData(routeProblemNumber)
const { actionConfirmations, setActionConfirmation } = useProblemsActionPreferences()
const {
  answerPlacement,
  printOptions,
  setAnswerPlacement,
  setPrintOption,
  setPrintPreset,
  setTypeColorMode,
  typeColorMode,
} = useQuestionPreferences()
const { practiceProblemIds, addProblemsToPracticeList } = useProblemsPracticeList()
const { completedProblemIds, favoriteProblemIds, setProblemCompleted, setProblemFavorite } =
  useProblemsUserMarks(PROBLEMS_PROTOTYPE_ITEMS)
const pendingConfirmation = ref(null)
const isPrinting = ref(false)
const operationFeedbackMessage = ref('')
const PRINT_BODY_CLASS = 'is-printing-question'
let titleBeforePrint = ''
let operationFeedbackTimer = 0

const isCompleted = computed(
  () => Boolean(problem.value) && completedProblemIds.value.includes(problem.value.id),
)
const isFavorite = computed(
  () => Boolean(problem.value) && favoriteProblemIds.value.includes(problem.value.id),
)
const isInPracticeList = computed(
  () => Boolean(problem.value) && practiceProblemIds.value.includes(problem.value.id),
)

function showOperationFeedback(message) {
  window.clearTimeout(operationFeedbackTimer)
  operationFeedbackMessage.value = message
  operationFeedbackTimer = window.setTimeout(() => {
    operationFeedbackMessage.value = ''
  }, 2200)
}

function applyCompletedChange(problemId, completed) {
  setProblemCompleted(problemId, completed)
  showOperationFeedback(
    completed ? `题目 ${problemId} 已标记为已做` : `题目 ${problemId} 已取消已做标记`,
  )
}

function applyFavoriteChange(problemId, favorite) {
  setProblemFavorite(problemId, favorite)
  showOperationFeedback(favorite ? `题目 ${problemId} 已加入收藏` : `题目 ${problemId} 已移出收藏`)
}

function requestAction(action, confirmationName) {
  if (actionConfirmations.value[confirmationName]) {
    pendingConfirmation.value = action
    return
  }

  if (action.kind === 'completed') {
    applyCompletedChange(action.problemId, action.value)
  } else {
    applyFavoriteChange(action.problemId, action.value)
  }
}

function toggleCompleted() {
  if (!problem.value) {
    return
  }

  const completed = !isCompleted.value
  requestAction(
    {
      kind: 'completed',
      problemId: problem.value.id,
      value: completed,
      title: completed ? '标记为已做？' : '取消已做标记？',
      description: completed
        ? `确认将题目 ${problem.value.id} 标记为“已做”。`
        : `取消后，题目 ${problem.value.id} 将恢复为“未做”状态。`,
      confirmLabel: completed ? '标记已做' : '取消已做',
    },
    completed ? 'markCompleted' : 'unmarkCompleted',
  )
}

function toggleFavorite() {
  if (!problem.value) {
    return
  }

  const favorite = !isFavorite.value
  requestAction(
    {
      kind: 'favorite',
      problemId: problem.value.id,
      value: favorite,
      title: favorite ? '加入收藏？' : '移出收藏？',
      description: favorite
        ? `确认将题目 ${problem.value.id} 加入收藏。`
        : `移出后，题目 ${problem.value.id} 将不再显示为已收藏。`,
      confirmLabel: favorite ? '加入收藏' : '移出收藏',
    },
    favorite ? 'addFavorite' : 'removeFavorite',
  )
}

function addToPracticeList() {
  if (!problem.value) {
    return
  }

  const newlyAddedProblemIds = addProblemsToPracticeList([problem.value.id])
  showOperationFeedback(
    newlyAddedProblemIds.length
      ? `题目 ${problem.value.id} 已加入本地题单`
      : `题目 ${problem.value.id} 已在本地题单中`,
  )
}

function cancelPendingConfirmation() {
  pendingConfirmation.value = null
}

function confirmPendingAction() {
  const action = pendingConfirmation.value

  if (!action) {
    return
  }

  if (action.kind === 'completed') {
    applyCompletedChange(action.problemId, action.value)
  } else {
    applyFavoriteChange(action.problemId, action.value)
  }

  pendingConfirmation.value = null
}

function updatePrintOption({ name, visible }) {
  setPrintOption(name, visible)
}

function updateActionConfirmation({ name, enabled }) {
  setActionConfirmation(name, enabled)
}

function finishPrint() {
  if (typeof document === 'undefined') {
    return
  }

  document.body.classList.remove(PRINT_BODY_CLASS)
  isPrinting.value = false

  if (titleBeforePrint) {
    document.title = titleBeforePrint
    titleBeforePrint = ''
  }
}

async function printQuestion(forPdf = false) {
  if (!problem.value || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  if (!Object.values(printOptions.value).some(Boolean)) {
    showOperationFeedback('请先在“个性化”的“打印内容”中至少选择一项')
    return
  }

  finishPrint()
  titleBeforePrint = document.title
  document.title = `高考数学单题练习-${problem.value.id}`
  isPrinting.value = true
  document.body.classList.add(PRINT_BODY_CLASS)

  if (forPdf) {
    showOperationFeedback('请在打印窗口中选择“另存为 PDF”')
  }

  try {
    await nextTick()
    window.print()
  } catch {
    finishPrint()
    showOperationFeedback('无法打开打印窗口，请检查浏览器设置')
  }
}

async function exportQuestion(format) {
  if (!problem.value) {
    return
  }

  if (format === 'pdf') {
    await printQuestion(true)
    return
  }

  try {
    if (format === 'image') {
      await exportProblemAsImage(problem.value)
      showOperationFeedback('题目图片已导出')
      return
    }

    await copyProblem(problem.value, format)
    const formatNames = {
      latex: 'LaTeX',
      markdown: 'Markdown',
      text: '纯文本',
    }
    showOperationFeedback(`已按 ${formatNames[format]} 格式复制`)
  } catch {
    showOperationFeedback(
      format === 'image' ? '图片导出失败，请检查浏览器支持' : '复制失败，请检查剪贴板权限',
    )
  }
}

watch(normalizedProblemNumber, () => {
  finishPrint()
  pendingConfirmation.value = null
  window.clearTimeout(operationFeedbackTimer)
  operationFeedbackMessage.value = ''
})

onMounted(() => {
  window.addEventListener('afterprint', finishPrint)
})

onBeforeUnmount(() => {
  window.removeEventListener('afterprint', finishPrint)
  window.clearTimeout(operationFeedbackTimer)
  finishPrint()
})
</script>

<template>
  <main class="question-page">
    <section v-if="isLoading" class="question-route-state" aria-live="polite">
      <p>正在加载题目……</p>
    </section>

    <section v-else-if="error" class="question-route-state" role="alert">
      <p>题目暂时无法加载，请稍后再试。</p>
      <RouterLink :to="{ name: 'problems' }">返回题库</RouterLink>
    </section>

    <section
      v-else-if="!problem"
      class="question-route-state"
      aria-labelledby="question-not-found-title"
    >
      <p class="question-route-state-code">404</p>
      <h1 id="question-not-found-title">没有找到这道题</h1>
      <p>题号“{{ normalizedProblemNumber || problemNumber }}”当前不在前端原型数据中。</p>
      <RouterLink :to="{ name: 'problems' }">返回题库</RouterLink>
    </section>

    <article v-else class="question-route-content" aria-labelledby="question-page-title">
      <QuestionHeader :key="problem.id" :problem="problem" :type-color-mode="typeColorMode">
        <template #actions>
          <div class="question-header-tool-row">
            <QuestionHeaderTools
              :in-practice-list="isInPracticeList"
              @add-to-list="addToPracticeList"
              @export="exportQuestion"
              @print="printQuestion"
            />
            <QuestionPersonalizationSettings
              :action-confirmations="actionConfirmations"
              :answer-placement="answerPlacement"
              :answer-placement-options="QUESTION_ANSWER_PLACEMENT_OPTIONS"
              :print-option-options="QUESTION_PRINT_OPTION_OPTIONS"
              :print-options="printOptions"
              :type-color-mode="typeColorMode"
              :type-color-options="QUESTION_TYPE_COLOR_OPTIONS"
              @action-confirmation-change="updateActionConfirmation"
              @answer-placement-change="setAnswerPlacement"
              @print-option-change="updatePrintOption"
              @print-preset-change="setPrintPreset"
              @type-color-change="setTypeColorMode"
            />
          </div>
        </template>
      </QuestionHeader>

      <div class="question-page-layout">
        <div class="question-main-column">
          <QuestionStem :problem="problem" />
          <QuestionForumPlaceholder :key="problem.id" />
          <QuestionAnswerSection
            v-if="answerPlacement === 'main'"
            :key="`main-answer-${problem.id}`"
            :problem="problem"
          />
        </div>

        <aside class="question-sidebar" aria-label="题目补充信息">
          <QuestionSidebar
            :key="problem.id"
            :answer-placement="answerPlacement"
            :completed="isCompleted"
            :favorite="isFavorite"
            :problem="problem"
            @toggle-completed="toggleCompleted"
            @toggle-favorite="toggleFavorite"
          />
        </aside>
      </div>
    </article>

    <QuestionPrintSheet v-if="problem && isPrinting" :options="printOptions" :problem="problem" />

    <p
      v-show="operationFeedbackMessage"
      class="question-operation-feedback"
      role="status"
      aria-live="polite"
    >
      {{ operationFeedbackMessage }}
    </p>

    <QuestionConfirmDialog
      :open="Boolean(pendingConfirmation)"
      :title="pendingConfirmation?.title"
      :description="pendingConfirmation?.description"
      :confirm-label="pendingConfirmation?.confirmLabel"
      @cancel="cancelPendingConfirmation"
      @confirm="confirmPendingAction"
    />
  </main>
</template>
