<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ProblemsBatchToolbar from '../components/problems/ProblemsBatchToolbar.vue'
import ProblemsConfirmDialog from '../components/problems/ProblemsConfirmDialog.vue'
import ProblemsFilterPanel from '../components/problems/ProblemsFilterPanel.vue'
import ProblemsHero from '../components/problems/ProblemsHero.vue'
import ProblemsInfiniteLoader from '../components/problems/ProblemsInfiniteLoader.vue'
import ProblemsOperationFeedback from '../components/problems/ProblemsOperationFeedback.vue'
import ProblemsResults from '../components/problems/ProblemsResults.vue'
import ProblemsToolbar from '../components/problems/ProblemsToolbar.vue'
import PracticeListPickerDialog from '../components/training/PracticeListPickerDialog.vue'
import { copyProblem, exportProblemAsImage } from '../composables/useProblemExport.js'
import { usePracticeListPicker } from '../composables/usePracticeListPicker.js'
import { useProblemsActionPreferences } from '../composables/useProblemsActionPreferences.js'
import { useProblemsDisplayPreferences } from '../composables/useProblemsDisplayPreferences.js'
import { useProblemsFilterPreferences } from '../composables/useProblemsFilterPreferences.js'
import { useProblemsData } from '../composables/useProblemsData.js'
import { PROBLEMS_PAGE_SIZE } from '../composables/useProblemsInfiniteList.js'
import { useProblemsPracticeList } from '../composables/useProblemsPracticeList.js'
import { useProblemPrint } from '../composables/useProblemPrint.js'
import {
  PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS,
  useProblemPrintPreferences,
} from '../composables/useProblemPrintPreferences.js'
import { useProblemsQuery } from '../composables/useProblemsQuery'
import { useProblemsSelection } from '../composables/useProblemsSelection.js'
import { useProblemsUserMarks } from '../composables/useProblemsUserMarks.js'
import { getCachedProblem, getProblem } from '../services/problemService.js'
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

const {
  tags,
  learning,
  learned,
  chapters,
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
const { practiceProblemIds } = useProblemsPracticeList()
const {
  authenticated: practiceListsAuthenticated,
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
  openPracticeListPickerForProblems,
  setPracticeListSelected,
} = usePracticeListPicker()
const {
  includePrintHeader,
  printOptions,
  printPageLayout,
  setIncludePrintHeader,
  setPrintOption,
  setPrintPageLayout,
  setPrintPreset,
} = useProblemPrintPreferences()
const { finishPrint, printProblems: openProblemPrintDialog } = useProblemPrint()
const { selectedProblemIds, clearSelection, setProblemSelected, setProblemsSelected } =
  useProblemsSelection()
const {
  completedProblemIds,
  favoriteProblemIds,
  setProblemCompleted,
  setProblemFavorite,
  syncMarksFromProblems,
} = useProblemsUserMarks(PROBLEMS_PROTOTYPE_ITEMS)
const openSolutionProblemIds = ref([])
const pendingConfirmation = ref(null)
const operationFeedbackMessage = ref('')
let operationFeedbackTimer = 0

const {
  error: problemsError,
  hasMoreProblems,
  isFallback: isUsingFallbackProblems,
  isLoading: isLoadingMore,
  isRefreshing,
  loadMoreProblems,
  problems: loadedProblems,
  reloadProblems,
  totalCount: problemsTotalCount,
} = useProblemsData(
  {
    tags,
    learning,
    learned,
    chapters,
    keyword,
    levels,
    questionTypes,
    sort,
    sources,
    years,
  },
  PROBLEMS_PAGE_SIZE,
)
const visibleProblemIds = computed(() => loadedProblems.value.map((problem) => problem.id))
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

async function toggleProblemSolution(problemId) {
  if (openSolutionProblemIds.value.includes(problemId)) {
    openSolutionProblemIds.value = openSolutionProblemIds.value.filter(
      (currentProblemId) => currentProblemId !== problemId,
    )
    return
  }

  const problemIndex = loadedProblems.value.findIndex((problem) => problem.id === problemId)
  const currentProblem = loadedProblems.value[problemIndex]

  if (currentProblem && !Object.hasOwn(currentProblem, 'solution')) {
    try {
      const problemDetail = await getProblem(problemId, { force: true })
      loadedProblems.value.splice(problemIndex, 1, problemDetail)
    } catch {
      showOperationFeedback(`题目 ${problemId} 的解析暂时无法加载`)
    }
  }

  openSolutionProblemIds.value = [...openSolutionProblemIds.value, problemId]
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
  openPracticeListPickerForProblems(selectedProblemIds.value)
}

function addProblemToPracticeList(problemId) {
  openPracticeListPickerForProblem(problemId)
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

  if (result.mode === 'manage') {
    const changed = result.addedMembershipCount + result.removedMembershipCount
    showOperationFeedback(
      changed ? `题目 ${result.problemId} 的题单归属已更新` : '题单归属没有变化',
    )
    return
  }

  showOperationFeedback(
    result.addedMembershipCount
      ? `已将所选题目加入 ${result.selectedListCount} 份题单`
      : '所选题目已在这些题单中',
  )
}

async function startPrint(problemIds, title, forPdf = false) {
  const entries = Array.from(new Set(problemIds))
    .map((problemId) => getCachedProblem(problemId))
    .filter(Boolean)
    .map((problem) => ({ key: problem.id, problem }))

  if (entries.length === 0) {
    return
  }

  if (forPdf) {
    showOperationFeedback('正在生成 PDF 文件……')
  }

  const result = await openProblemPrintDialog({
    documentTitle: title,
    entries,
    forPdf,
    header: { eyebrow: '高考数学练习', title },
    includeHeader: includePrintHeader.value,
    options: printOptions.value,
    pageLayout: printPageLayout.value,
  })

  if (result.reason === 'no-content') {
    showOperationFeedback('请先在“个性化设置”的“打印内容”中至少选择一项')
  } else if (forPdf && result.ok) {
    showOperationFeedback('PDF 文件已导出')
  } else if (result.reason === 'pdf-unavailable') {
    showOperationFeedback('PDF 导出失败，请稍后重试')
  } else if (result.reason === 'print-unavailable') {
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

onBeforeUnmount(() => {
  window.clearTimeout(operationFeedbackTimer)
  finishPrint()
})

watch(loadedProblems, (items) => syncMarksFromProblems(items), { immediate: true })
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
          :include-print-header="includePrintHeader"
          :print-option-options="PROBLEMS_PRINT_OPTION_OPTIONS"
          :print-options="printOptions"
          :print-page-layout="printPageLayout"
          :print-page-layout-options="PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS"
          :sort="sort"
          :sort-options="PROBLEMS_SORT_OPTIONS"
          :total-count="problemsTotalCount"
          :view-mode="viewMode"
          @action-confirmation-change="updateActionConfirmation"
          @display-option-change="updateDisplayOption"
          @display-options-all="setAllDisplayOptions(true)"
          @display-options-minimal="setAllDisplayOptions(false)"
          @include-print-header-change="setIncludePrintHeader"
          @print-option-change="updatePrintOption"
          @print-page-layout-change="setPrintPageLayout"
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

        <div
          v-if="isLoadingMore && (loadedProblems.length === 0 || isRefreshing)"
          class="bank-problems-data-state"
          role="status"
          aria-live="polite"
        >
          {{ loadedProblems.length ? '正在更新筛选结果…' : '正在从题库加载题目…' }}
        </div>

        <div
          v-else-if="isUsingFallbackProblems"
          class="bank-problems-data-state is-warning"
          role="status"
        >
          <span>后端题库暂时无法连接，当前显示内置示例题。</span>
          <button type="button" @click="reloadProblems">重新连接</button>
        </div>

        <div v-else-if="problemsError" class="bank-problems-data-state is-warning" role="alert">
          <span>{{ problemsError.message || '加载题目失败，请稍后重试。' }}</span>
          <button type="button" @click="reloadProblems">重新加载</button>
        </div>

        <ProblemsResults
          v-if="!isLoadingMore || loadedProblems.length > 0"
          :refreshing="isRefreshing"
          :completed-problem-ids="completedProblemIds"
          :display-options="displayOptions"
          :favorite-problem-ids="favoriteProblemIds"
          :open-solution-problem-ids="openSolutionProblemIds"
          :practice-problem-ids="practiceProblemIds"
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
          :total-count="problemsTotalCount"
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

    <PracticeListPickerDialog
      :authenticated="practiceListsAuthenticated"
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
  </div>
</template>
