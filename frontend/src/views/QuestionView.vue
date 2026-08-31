<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import QuestionAnswerSection from '../components/question/QuestionAnswerSection.vue'
import QuestionConfirmDialog from '../components/question/QuestionConfirmDialog.vue'
import QuestionForumPlaceholder from '../components/question/QuestionForumPlaceholder.vue'
import QuestionHeader from '../components/question/QuestionHeader.vue'
import QuestionHeaderTools from '../components/question/QuestionHeaderTools.vue'
import QuestionPersonalizationSettings from '../components/question/QuestionPersonalizationSettings.vue'
import QuestionSidebar from '../components/question/QuestionSidebar.vue'
import QuestionStem from '../components/question/QuestionStem.vue'
import PracticeListPickerDialog from '../components/training/PracticeListPickerDialog.vue'
import { copyProblem, exportProblemAsImage } from '../composables/useProblemExport.js'
import { useProblemPrint } from '../composables/useProblemPrint.js'
import { PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS } from '../composables/useProblemPrintPreferences.js'
import { usePracticeListPicker } from '../composables/usePracticeListPicker.js'
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
  includePrintHeader,
  printOptions,
  printPageLayout,
  setAnswerPlacement,
  setIncludePrintHeader,
  setPrintOption,
  setPrintPageLayout,
  setPrintPreset,
  setTypeColorMode,
  typeColorMode,
} = useQuestionPreferences()
const { finishPrint, printProblems: openProblemPrintDialog } = useProblemPrint()
const { practiceProblemIds } = useProblemsPracticeList()
const {
  defaultPracticeListId,
  pickerMode,
  pickerOpen,
  pickerProblemIds,
  practiceLists,
  selectedPracticeListIds,
  applyPracticeListSelection,
  closePracticeListPicker,
  createPracticeListFromPicker,
  openPracticeListPickerForProblem,
  setPracticeListSelected,
} = usePracticeListPicker()
const {
  completedProblemIds,
  favoriteProblemIds,
  setProblemCompleted,
  setProblemFavorite,
  syncMarksFromProblems,
} =
  useProblemsUserMarks(PROBLEMS_PROTOTYPE_ITEMS)
watch(problem, (item) => syncMarksFromProblems(item ? [item] : []), { immediate: true })
const pendingConfirmation = ref(null)
const operationFeedbackMessage = ref('')
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

  openPracticeListPickerForProblem(problem.value.id)
}

async function createPickerPracticeList(formValue) {
  try {
    const practiceList = await createPracticeListFromPicker(formValue)
    showOperationFeedback(`题单“${practiceList.title}”已创建并选中`)
  } catch (error) {
    showOperationFeedback(error?.message || '题单创建失败')
  }
}

async function applyPickerSelection() {
  const result = await applyPracticeListSelection()
  const changed = result.addedMembershipCount + result.removedMembershipCount
  showOperationFeedback(changed ? `题目 ${result.problemId} 的题单归属已更新` : '题单归属没有变化')
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

async function printQuestion(forPdf = false) {
  if (!problem.value) {
    return
  }

  if (forPdf) {
    showOperationFeedback('请在打印窗口中选择“另存为 PDF”')
  }

  const result = await openProblemPrintDialog({
    documentTitle: `高考数学单题练习-${problem.value.id}`,
    entries: [{ key: problem.value.id, problem: problem.value }],
    forPdf,
    header: { eyebrow: '高考数学单题练习', title: problem.value.title },
    includeHeader: includePrintHeader.value,
    options: printOptions.value,
    pageLayout: printPageLayout.value,
  })

  if (result.reason === 'no-content') {
    showOperationFeedback('请先在“个性化设置”的“打印内容”中至少选择一项')
  } else if (result.reason === 'print-unavailable') {
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
  closePracticeListPicker()
  window.clearTimeout(operationFeedbackTimer)
  operationFeedbackMessage.value = ''
})

onBeforeUnmount(() => {
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
              :include-print-header="includePrintHeader"
              :print-option-options="QUESTION_PRINT_OPTION_OPTIONS"
              :print-options="printOptions"
              :print-page-layout="printPageLayout"
              :print-page-layout-options="PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS"
              :type-color-mode="typeColorMode"
              :type-color-options="QUESTION_TYPE_COLOR_OPTIONS"
              @action-confirmation-change="updateActionConfirmation"
              @answer-placement-change="setAnswerPlacement"
              @include-print-header-change="setIncludePrintHeader"
              @print-option-change="updatePrintOption"
              @print-page-layout-change="setPrintPageLayout"
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

    <PracticeListPickerDialog
      :default-list-id="defaultPracticeListId"
      :lists="practiceLists"
      :mode="pickerMode"
      :open="pickerOpen"
      :problem-count="pickerProblemIds.length"
      :selected-list-ids="selectedPracticeListIds"
      @apply="applyPickerSelection"
      @cancel="closePracticeListPicker"
      @create-list="createPickerPracticeList"
      @selection-change="setPracticeListSelected"
    />
  </main>
</template>
