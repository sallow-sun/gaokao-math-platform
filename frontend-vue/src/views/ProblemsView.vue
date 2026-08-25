<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ProblemsBatchToolbar from '../components/problems/ProblemsBatchToolbar.vue'
import ProblemsConfirmDialog from '../components/problems/ProblemsConfirmDialog.vue'
import ProblemsFilterPanel from '../components/problems/ProblemsFilterPanel.vue'
import ProblemsHero from '../components/problems/ProblemsHero.vue'
import ProblemsInfiniteLoader from '../components/problems/ProblemsInfiniteLoader.vue'
import ProblemsOperationFeedback from '../components/problems/ProblemsOperationFeedback.vue'
import ProblemsResults from '../components/problems/ProblemsResults.vue'
import ProblemsToolbar from '../components/problems/ProblemsToolbar.vue'
import { copyProblem, exportProblemAsImage } from '../composables/useProblemExport.js'
import { useProblemsActionPreferences } from '../composables/useProblemsActionPreferences.js'
import { useProblemsDisplayPreferences } from '../composables/useProblemsDisplayPreferences.js'
import { useProblemsFilterPreferences } from '../composables/useProblemsFilterPreferences.js'
import {
  PROBLEMS_PAGE_SIZE,
  useProblemsInfiniteList,
} from '../composables/useProblemsInfiniteList.js'
import { useProblemsPracticeList } from '../composables/useProblemsPracticeList.js'
import { useProblemsPrintPreferences } from '../composables/useProblemsPrintPreferences.js'
import { useProblemsQuery } from '../composables/useProblemsQuery'
import { useProblemsSelection } from '../composables/useProblemsSelection.js'
import { useProblemsUserMarks } from '../composables/useProblemsUserMarks.js'
import { usePrototypeProblems } from '../composables/usePrototypeProblems.js'
import {
  PROBLEMS_DISPLAY_OPTION_OPTIONS,
  PROBLEMS_LEVEL_OPTIONS,
  PROBLEMS_PRINT_OPTION_OPTIONS,
  PROBLEMS_PROTOTYPE_ITEMS,
  PROBLEMS_SOURCE_CATALOG_OPTIONS,
  PROBLEMS_SORT_OPTIONS,
  PROBLEMS_TYPE_CATALOG_OPTIONS,
  PROBLEMS_YEAR_CATALOG_OPTIONS,
} from '../config/problems'
import '../assets/styles/problems.css'

const {
  keyword,
  level,
  levels,
  questionType,
  questionTypes,
  source,
  sources,
  sort,
  year,
  years,
  clearFilters,
  collapseFiltersToSingle,
  updateKeyword,
  updateLevel,
  updateSource,
  updateSort,
  updateType,
  updateYear,
} = useProblemsQuery()

const { filterMode, pinnedFilters, setFilterMode, setFilterPinned } = useProblemsFilterPreferences()
const { actionConfirmations, setActionConfirmation } = useProblemsActionPreferences()
const { displayOptions, viewMode, setAllDisplayOptions, setDisplayOption, setViewMode } =
  useProblemsDisplayPreferences()
const { practiceProblemIds, addProblemsToPracticeList } = useProblemsPracticeList()
const { printOptions, setPrintOption, setPrintPreset } = useProblemsPrintPreferences()
const { selectedProblemIds, clearSelection, setProblemSelected, setProblemsSelected } =
  useProblemsSelection()
const { completedProblemIds, favoriteProblemIds, setProblemCompleted, setProblemFavorite } =
  useProblemsUserMarks(PROBLEMS_PROTOTYPE_ITEMS)
const printingProblemIds = ref([])
const openSolutionProblemIds = ref([])
const pendingConfirmation = ref(null)
const operationFeedbackMessage = ref('')
let titleBeforePrint = ''
let operationFeedbackTimer = 0

const PRINT_BODY_CLASS = 'is-printing-problems'
const PRINT_OPTION_BODY_CLASSES = PROBLEMS_PRINT_OPTION_OPTIONS.map(
  (option) => `print-hide-${option.value}`,
)

const filteredProblems = usePrototypeProblems({
  keyword,
  levels,
  problems: PROBLEMS_PROTOTYPE_ITEMS,
  questionTypes,
  sort,
  sources,
  years,
})
const { hasMoreProblems, isLoadingMore, loadedProblems, loadMoreProblems } =
  useProblemsInfiniteList(filteredProblems, PROBLEMS_PAGE_SIZE)
const visibleProblemIds = computed(() => loadedProblems.value.map((problem) => problem.id))
const printProblems = computed(() =>
  printingProblemIds.value
    .map((problemId) => PROBLEMS_PROTOTYPE_ITEMS.find((problem) => problem.id === problemId))
    .filter(Boolean),
)
const visibleSelectedCount = computed(
  () =>
    visibleProblemIds.value.filter((problemId) => selectedProblemIds.value.includes(problemId))
      .length,
)
const allVisibleSelected = computed(
  () =>
    visibleProblemIds.value.length > 0 &&
    visibleSelectedCount.value === visibleProblemIds.value.length,
)
const someVisibleSelected = computed(() => visibleSelectedCount.value > 0)

const visibleYearOptions = computed(() => [
  PROBLEMS_YEAR_CATALOG_OPTIONS[0],
  ...pinnedFilters.value.year
    .map((value) => PROBLEMS_YEAR_CATALOG_OPTIONS.find((option) => option.value === value))
    .filter(Boolean),
])

const visibleSourceOptions = computed(() => [
  PROBLEMS_SOURCE_CATALOG_OPTIONS[0],
  ...pinnedFilters.value.source
    .map((value) => PROBLEMS_SOURCE_CATALOG_OPTIONS.find((option) => option.value === value))
    .filter(Boolean),
])

const visibleTypeOptions = computed(() => [
  PROBLEMS_TYPE_CATALOG_OPTIONS[0],
  ...pinnedFilters.value.type
    .map((value) => PROBLEMS_TYPE_CATALOG_OPTIONS.find((option) => option.value === value))
    .filter(Boolean),
])

function updateSourcePinned({ value, pinned }) {
  setFilterPinned('source', value, pinned)
}

function updateTypePinned({ value, pinned }) {
  setFilterPinned('type', value, pinned)
}

function updateYearPinned({ value, pinned }) {
  setFilterPinned('year', value, pinned)
}

function updateFilterMode(nextMode) {
  setFilterMode(nextMode)

  if (nextMode === 'single') {
    collapseFiltersToSingle()
  }
}

function updateDisplayOption({ name, visible }) {
  setDisplayOption(name, visible)
}

function updatePrintOption({ name, visible }) {
  setPrintOption(name, visible)
}

function updateActionConfirmation({ name, enabled }) {
  setActionConfirmation(name, enabled)
}

function showOperationFeedback(message) {
  window.clearTimeout(operationFeedbackTimer)
  operationFeedbackMessage.value = message
  operationFeedbackTimer = window.setTimeout(() => {
    operationFeedbackMessage.value = ''
  }, 2200)
}

function updateProblemSelection({ problemId, selected }) {
  setProblemSelected(problemId, selected)
}

function toggleProblemSolution(problemId) {
  openSolutionProblemIds.value = openSolutionProblemIds.value.includes(problemId)
    ? openSolutionProblemIds.value.filter((currentProblemId) => currentProblemId !== problemId)
    : [...openSolutionProblemIds.value, problemId]
}

function applyProblemCompletedChange(problemId, completed) {
  setProblemCompleted(problemId, completed)
  showOperationFeedback(
    completed ? `题目 ${problemId} 已标记为已做` : `题目 ${problemId} 已取消已做标记`,
  )
}

function applyProblemFavoriteChange(problemId, favorite) {
  setProblemFavorite(problemId, favorite)
  showOperationFeedback(favorite ? `题目 ${problemId} 已加入收藏` : `题目 ${problemId} 已移出收藏`)
}

function requestProblemAction(action, confirmationName) {
  if (actionConfirmations.value[confirmationName]) {
    pendingConfirmation.value = action
    return
  }

  if (action.kind === 'completed') {
    applyProblemCompletedChange(action.problemId, action.value)
  } else {
    applyProblemFavoriteChange(action.problemId, action.value)
  }
}

function toggleProblemCompleted(problemId) {
  const completed = !completedProblemIds.value.includes(problemId)

  requestProblemAction(
    {
      kind: 'completed',
      problemId,
      value: completed,
      title: completed ? '标记为已做？' : '取消已做标记？',
      description: completed
        ? `确认将题目 ${problemId} 标记为“已做”。`
        : `取消后，题目 ${problemId} 将恢复为“未做”状态。`,
      confirmLabel: completed ? '标记已做' : '取消已做',
    },
    completed ? 'markCompleted' : 'unmarkCompleted',
  )
}

function toggleProblemFavorite(problemId) {
  const favorite = !favoriteProblemIds.value.includes(problemId)

  requestProblemAction(
    {
      kind: 'favorite',
      problemId,
      value: favorite,
      title: favorite ? '加入收藏？' : '移出收藏？',
      description: favorite
        ? `确认将题目 ${problemId} 加入收藏。`
        : `移出后，题目 ${problemId} 将不再显示为已收藏。`,
      confirmLabel: favorite ? '加入收藏' : '移出收藏',
    },
    favorite ? 'addFavorite' : 'removeFavorite',
  )
}

function cancelPendingConfirmation() {
  pendingConfirmation.value = null
}

function confirmPendingAction() {
  const pendingAction = pendingConfirmation.value

  if (!pendingAction) {
    return
  }

  if (pendingAction.kind === 'completed') {
    applyProblemCompletedChange(pendingAction.problemId, pendingAction.value)
  } else if (pendingAction.kind === 'favorite') {
    applyProblemFavoriteChange(pendingAction.problemId, pendingAction.value)
  }

  pendingConfirmation.value = null
}

function updateVisibleSelection(selected) {
  setProblemsSelected(visibleProblemIds.value, selected)
}

function clearProblemSelection() {
  clearSelection()
}

function addSelectedProblemsToPracticeList() {
  const newlyAddedProblemIds = addProblemsToPracticeList(selectedProblemIds.value)
  showOperationFeedback(
    newlyAddedProblemIds.length
      ? `已将 ${newlyAddedProblemIds.length} 道题加入本地题单`
      : '所选题目已在本地题单中',
  )
}

function addProblemToPracticeList(problemId) {
  const newlyAddedProblemIds = addProblemsToPracticeList([problemId])
  showOperationFeedback(
    newlyAddedProblemIds.length
      ? `题目 ${problemId} 已加入本地题单`
      : `题目 ${problemId} 已在本地题单中`,
  )
}

function finishPrint() {
  if (typeof document === 'undefined') {
    return
  }

  document.body.classList.remove(PRINT_BODY_CLASS, ...PRINT_OPTION_BODY_CLASSES)
  printingProblemIds.value = []

  if (titleBeforePrint) {
    document.title = titleBeforePrint
    titleBeforePrint = ''
  }
}

async function startPrint(problemIds, title, forPdf = false) {
  if (problemIds.length === 0 || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  if (!Object.values(printOptions.value).some(Boolean)) {
    showOperationFeedback('请先在“个性化设置”的“打印内容”中至少选择一项')
    return
  }

  finishPrint()
  titleBeforePrint = document.title
  document.title = title
  printingProblemIds.value = Array.from(new Set(problemIds))
  document.body.classList.add(PRINT_BODY_CLASS)

  PROBLEMS_PRINT_OPTION_OPTIONS.forEach((option) => {
    if (!printOptions.value[option.value]) {
      document.body.classList.add(`print-hide-${option.value}`)
    }
  })

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

function printSelectedProblems() {
  startPrint(selectedProblemIds.value, '高考数学练习卷')
}

function printSingleProblem(problem) {
  startPrint([problem.id], `高考数学单题练习-${problem.id}`)
}

async function exportProblem({ format, problem }) {
  if (format === 'pdf') {
    await startPrint([problem.id], problem.title, true)
    return
  }

  try {
    if (format === 'image') {
      await exportProblemAsImage(problem)
      showOperationFeedback('题目图片已导出')
      return
    }

    await copyProblem(problem, format)
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
  <div class="problems-page">
    <main class="problems-main">
      <ProblemsHero />

      <ProblemsFilterPanel
        :filter-mode="filterMode"
        :keyword="keyword"
        :level="filterMode === 'multiple' ? levels : level"
        :level-options="PROBLEMS_LEVEL_OPTIONS"
        :question-type="filterMode === 'multiple' ? questionTypes : questionType"
        :source="filterMode === 'multiple' ? sources : source"
        :source-catalog-options="PROBLEMS_SOURCE_CATALOG_OPTIONS"
        :source-options="visibleSourceOptions"
        :source-pinned-values="pinnedFilters.source"
        :type-catalog-options="PROBLEMS_TYPE_CATALOG_OPTIONS"
        :type-options="visibleTypeOptions"
        :type-pinned-values="pinnedFilters.type"
        :year="filterMode === 'multiple' ? years : year"
        :year-catalog-options="PROBLEMS_YEAR_CATALOG_OPTIONS"
        :year-options="visibleYearOptions"
        :year-pinned-values="pinnedFilters.year"
        @search="updateKeyword"
        @clear="clearFilters"
        @filter-mode-change="updateFilterMode"
        @level-change="updateLevel"
        @source-change="updateSource"
        @source-pin-change="updateSourcePinned"
        @type-change="updateType"
        @type-pin-change="updateTypePinned"
        @year-change="updateYear"
        @year-pin-change="updateYearPinned"
      />

      <section
        class="bank-results-panel"
        aria-labelledby="bank-result-title"
        :data-view-mode="viewMode"
      >
        <ProblemsToolbar
          :action-confirmations="actionConfirmations"
          :display-options="displayOptions"
          :display-option-options="PROBLEMS_DISPLAY_OPTION_OPTIONS"
          :print-option-options="PROBLEMS_PRINT_OPTION_OPTIONS"
          :print-options="printOptions"
          :sort="sort"
          :sort-options="PROBLEMS_SORT_OPTIONS"
          :total-count="filteredProblems.length"
          :view-mode="viewMode"
          @action-confirmation-change="updateActionConfirmation"
          @display-option-change="updateDisplayOption"
          @display-options-all="setAllDisplayOptions(true)"
          @display-options-minimal="setAllDisplayOptions(false)"
          @print-option-change="updatePrintOption"
          @print-preset-change="setPrintPreset"
          @sort-change="updateSort"
          @view-mode-change="setViewMode"
        />

        <ProblemsBatchToolbar
          v-if="selectedProblemIds.length > 0"
          :all-visible-selected="allVisibleSelected"
          :selected-count="selectedProblemIds.length"
          :some-visible-selected="someVisibleSelected"
          :visible-count="visibleProblemIds.length"
          @add-to-list="addSelectedProblemsToPracticeList"
          @clear="clearProblemSelection"
          @print="printSelectedProblems"
          @select-all-change="updateVisibleSelection"
        />

        <ProblemsResults
          :completed-problem-ids="completedProblemIds"
          :display-options="displayOptions"
          :favorite-problem-ids="favoriteProblemIds"
          :open-solution-problem-ids="openSolutionProblemIds"
          :practice-problem-ids="practiceProblemIds"
          :print-problems="printProblems"
          :problems="loadedProblems"
          :selected-problem-ids="selectedProblemIds"
          :view-mode="viewMode"
          @add-to-list="addProblemToPracticeList"
          @export="exportProblem"
          @print="printSingleProblem"
          @selection-change="updateProblemSelection"
          @toggle-completed="toggleProblemCompleted"
          @toggle-favorite="toggleProblemFavorite"
          @toggle-solution="toggleProblemSolution"
        />

        <ProblemsInfiniteLoader
          :has-more="hasMoreProblems"
          :is-loading="isLoadingMore"
          :loaded-count="loadedProblems.length"
          :page-size="PROBLEMS_PAGE_SIZE"
          :total-count="filteredProblems.length"
          @load-more="loadMoreProblems"
        />
      </section>
    </main>

    <ProblemsOperationFeedback :message="operationFeedbackMessage" />

    <ProblemsConfirmDialog
      :confirm-label="pendingConfirmation?.confirmLabel"
      :description="pendingConfirmation?.description"
      :open="Boolean(pendingConfirmation)"
      :title="pendingConfirmation?.title"
      @cancel="cancelPendingConfirmation"
      @confirm="confirmPendingAction"
    />
  </div>
</template>
