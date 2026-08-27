<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import TrainingConfirmDialog from '../components/training/TrainingConfirmDialog.vue'
import TrainingEditDialog from '../components/training/TrainingEditDialog.vue'
import TrainingNoteWorkspace from '../components/training/TrainingNoteWorkspace.vue'
import TrainingPersonalizationSettings from '../components/training/TrainingPersonalizationSettings.vue'
import TrainingProblemItem from '../components/training/TrainingProblemItem.vue'
import { sharePracticeList } from '../composables/usePracticeListExport.js'
import {
  getPracticeListDropIndex,
  formatPracticeListProblemContent,
  parsePracticeListProblemIds,
} from '../composables/usePracticeListArrangement.js'
import {
  PRACTICE_LIST_PRINT_PAGE_LAYOUTS,
  usePracticeListOutputPreferences,
} from '../composables/usePracticeListOutputPreferences.js'
import { usePracticeListViewPreferences } from '../composables/usePracticeListViewPreferences.js'
import { useProblemsActionPreferences } from '../composables/useProblemsActionPreferences.js'
import { useProblemPrint } from '../composables/useProblemPrint.js'
import { useProblemPrintPreferences } from '../composables/useProblemPrintPreferences.js'
import { useProblemsUserMarks } from '../composables/useProblemsUserMarks.js'
import { findPrototypeProblem } from '../composables/useQuestionData.js'
import { PROBLEMS_PRINT_OPTION_OPTIONS, PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'
import { usePracticeListsStore } from '../stores/practiceLists.js'
import '../assets/styles/training.css'

const props = defineProps({
  practiceListId: {
    type: String,
    required: true,
  },
})

const router = useRouter()
const practiceListsStore = usePracticeListsStore()
const {
  includeNotes,
  includePrintHeader,
  printPageLayout,
  setIncludeNotes,
  setIncludePrintHeader,
  setPrintPageLayout,
} = usePracticeListOutputPreferences()
const { viewMode, setViewMode } = usePracticeListViewPreferences()
const { actionConfirmations, setActionConfirmation } = useProblemsActionPreferences()
const { printOptions, setPrintOption, setPrintPreset } = useProblemPrintPreferences()
const { finishPrint, printProblems: openProblemPrintDialog } = useProblemPrint()
const { completedProblemIds, setProblemCompleted } = useProblemsUserMarks(PROBLEMS_PROTOTYPE_ITEMS)
const activeNoteListId = ref('')
const activeNoteProblemId = ref('')
const batchMode = ref(false)
const editDialogOpen = ref(false)
const draggedProblemId = ref('')
const dragTargetPosition = ref('')
const dragTargetProblemId = ref('')
const managementMenu = ref(null)
const pendingConfirmation = ref(null)
const noteDraft = ref('')
const noteSaveStatus = ref('saved')
const noteStorageAvailable = ref(true)
const problemImportMessage = ref('')
const problemImportStatus = ref('')
const problemImportValue = ref('')
const selectedProblemIds = ref([])
const operationFeedbackMessage = ref('')
const NOTE_AUTOSAVE_DELAY = 800
let noteAutosaveTimer = 0
let operationFeedbackTimer = 0

const practiceList = computed(() => practiceListsStore.getPracticeListById(props.practiceListId))
const isDefaultPracticeList = computed(
  () => practiceList.value?.id === practiceListsStore.defaultListId,
)
const problemEntries = computed(
  () =>
    practiceList.value?.items.map((item, index) => ({
      item,
      position: index + 1,
      problem: findPrototypeProblem(item.problemId),
    })) ?? [],
)
const completedPracticeListCount = computed(
  () =>
    problemEntries.value.filter((entry) => completedProblemIds.value.includes(entry.item.problemId))
      .length,
)
const completionRate = computed(() =>
  problemEntries.value.length
    ? Math.round((completedPracticeListCount.value / problemEntries.value.length) * 100)
    : 0,
)
const noteCount = computed(() => practiceList.value?.items.filter((item) => item.note).length ?? 0)
const activeNoteEntry = computed(
  () =>
    problemEntries.value.find((entry) => entry.item.problemId === activeNoteProblemId.value) ??
    null,
)
const activeNoteIndex = computed(() =>
  problemEntries.value.findIndex((entry) => entry.item.problemId === activeNoteProblemId.value),
)
const hasPreviousNoteEntry = computed(() => activeNoteIndex.value > 0)
const hasNextNoteEntry = computed(
  () => activeNoteIndex.value >= 0 && activeNoteIndex.value < problemEntries.value.length - 1,
)
const selectedEntries = computed(() =>
  problemEntries.value.filter((entry) => selectedProblemIds.value.includes(entry.item.problemId)),
)
const allProblemsSelected = computed(
  () =>
    problemEntries.value.length > 0 &&
    selectedProblemIds.value.length === problemEntries.value.length,
)
const nextPracticeEntry = computed(
  () =>
    problemEntries.value.find(
      (entry) => entry.problem && !completedProblemIds.value.includes(entry.item.problemId),
    ) ?? problemEntries.value.find((entry) => entry.problem),
)
const practiceActionLabel = computed(() => {
  if (completedPracticeListCount.value === 0) {
    return '开始练习'
  }

  if (completedPracticeListCount.value >= problemEntries.value.length) {
    return '重新练习'
  }

  return '继续练习'
})

function showOperationFeedback(message) {
  window.clearTimeout(operationFeedbackTimer)
  operationFeedbackMessage.value = message
  operationFeedbackTimer = window.setTimeout(() => {
    operationFeedbackMessage.value = ''
  }, 2200)
}

function closeManagementMenu({ restoreFocus = false } = {}) {
  const menu = managementMenu.value

  if (!menu?.open) {
    return
  }

  menu.removeAttribute('open')

  if (restoreFocus) {
    menu.querySelector('summary')?.focus()
  }
}

function handleManagementMenuPointerDown(event) {
  if (managementMenu.value?.open && !managementMenu.value.contains(event.target)) {
    closeManagementMenu()
  }
}

function handleManagementMenuKeydown(event) {
  if (event.key === 'Escape' && managementMenu.value?.open) {
    event.preventDefault()
    closeManagementMenu({ restoreFocus: true })
  }
}

function openEditDialog() {
  closeManagementMenu()
  editDialogOpen.value = true
}

function closeEditDialog() {
  editDialogOpen.value = false
}

function savePracticeList(changes) {
  if (!practiceList.value) {
    return
  }

  if (practiceListsStore.updatePracticeList(practiceList.value.id, changes)) {
    closeEditDialog()
    showOperationFeedback('题单信息已保存')
  }
}

function setAsDefaultPracticeList() {
  closeManagementMenu()

  if (!practiceList.value || isDefaultPracticeList.value) {
    return
  }

  if (practiceListsStore.setDefaultPracticeList(practiceList.value.id)) {
    showOperationFeedback('已设为默认题单')
  }
}

function requestDeletePracticeList() {
  closeManagementMenu()

  if (!practiceList.value) {
    return
  }

  pendingConfirmation.value = {
    kind: 'delete-list',
    title: `删除题单“${practiceList.value.title}”？`,
    description: '题单中的排序和备注将从此浏览器删除，原题库中的题目不会受到影响。',
    confirmLabel: '删除题单',
  }
}

function requestRemoveProblem(problemId) {
  pendingConfirmation.value = {
    kind: 'remove-problem',
    problemId,
    title: `从题单移除题目 ${problemId}？`,
    description: '该题在当前题单中的备注也会删除，题库中的原题不会受到影响。',
    confirmLabel: '移除题目',
  }
}

function requestRemoveSelectedProblems() {
  if (selectedProblemIds.value.length === 0) {
    return
  }

  pendingConfirmation.value = {
    kind: 'remove-problems',
    problemIds: [...selectedProblemIds.value],
    title: `从题单移除选中的 ${selectedProblemIds.value.length} 道题？`,
    description: '这些题目在当前题单中的备注也会删除，题库中的原题不会受到影响。',
    confirmLabel: '批量移除',
  }
}

function cancelPendingConfirmation() {
  pendingConfirmation.value = null
}

async function confirmPendingAction() {
  const action = pendingConfirmation.value
  const currentPracticeList = practiceList.value

  if (!action || !currentPracticeList) {
    pendingConfirmation.value = null
    return
  }

  if (action.kind === 'delete-list') {
    resetNoteWorkspace({ save: false })
    practiceListsStore.deletePracticeList(currentPracticeList.id)
    pendingConfirmation.value = null
    await router.replace({ name: 'training', query: { tab: 'mine' } })
    return
  }

  if (action.kind === 'remove-problem') {
    if (activeNoteProblemId.value === action.problemId) {
      resetNoteWorkspace({ save: false })
    }

    if (
      practiceListsStore.removeProblemFromPracticeList(currentPracticeList.id, action.problemId)
    ) {
      showOperationFeedback(`题目 ${action.problemId} 已移出题单`)
    }
  }

  if (action.kind === 'remove-problems') {
    if (action.problemIds.includes(activeNoteProblemId.value)) {
      resetNoteWorkspace({ save: false })
    }

    const removedProblemIds = practiceListsStore.removeProblemsFromPracticeList(
      currentPracticeList.id,
      action.problemIds,
    )

    selectedProblemIds.value = []
    batchMode.value = false

    if (removedProblemIds.length > 0) {
      showOperationFeedback(`已从题单移除 ${removedProblemIds.length} 道题`)
    }
  }

  if (action.kind === 'toggle-completed') {
    applyProblemCompletedChange(action.problemId, action.value)
  }

  pendingConfirmation.value = null
}

function moveProblem(problemId, targetIndex) {
  if (!practiceList.value) {
    return
  }

  if (practiceListsStore.moveProblemInPracticeList(practiceList.value.id, problemId, targetIndex)) {
    showOperationFeedback('题目顺序已调整')
  }
}

function applyProblemCompletedChange(problemId, completed) {
  setProblemCompleted(problemId, completed)
  showOperationFeedback(
    completed ? `题目 ${problemId} 已标记为已做` : `题目 ${problemId} 已取消已做`,
  )
}

function updateProblemCompleted(problemId, completed) {
  const confirmationName = completed ? 'markCompleted' : 'unmarkCompleted'

  if (!actionConfirmations.value[confirmationName]) {
    applyProblemCompletedChange(problemId, completed)
    return
  }

  pendingConfirmation.value = {
    kind: 'toggle-completed',
    problemId,
    value: completed,
    title: completed ? '标记为已做？' : '取消已做标记？',
    description: completed
      ? `确认将题目 ${problemId} 标记为“已做”。`
      : `取消后，题目 ${problemId} 将恢复为“未做”状态。`,
    confirmLabel: completed ? '标记已做' : '取消已做',
  }
}

function enterBatchMode() {
  resetNoteWorkspace()
  finishProblemDrag()
  selectedProblemIds.value = []
  batchMode.value = true
}

function exitBatchMode() {
  selectedProblemIds.value = []
  batchMode.value = false
}

function setProblemSelected(problemId, selected) {
  selectedProblemIds.value = selected
    ? [...new Set([...selectedProblemIds.value, problemId])]
    : selectedProblemIds.value.filter((currentProblemId) => currentProblemId !== problemId)
}

function selectAllProblems() {
  selectedProblemIds.value = problemEntries.value.map((entry) => entry.item.problemId)
}

function clearProblemSelection() {
  selectedProblemIds.value = []
}

function printSelectedProblems() {
  if (selectedEntries.value.length === 0) {
    return
  }

  return startPracticeListPrint(
    selectedEntries.value,
    `高考数学题单-${practiceList.value?.title ?? '题单'}-所选题目`,
  )
}

function clearNoteAutosaveTimer() {
  window.clearTimeout(noteAutosaveTimer)
  noteAutosaveTimer = 0
}

function persistActiveNote() {
  clearNoteAutosaveTimer()

  if (!activeNoteListId.value || !activeNoteProblemId.value) {
    return false
  }

  const targetPracticeList = practiceListsStore.getPracticeListById(activeNoteListId.value)
  const targetItem = targetPracticeList?.items.find(
    (item) => item.problemId === activeNoteProblemId.value,
  )
  const normalizedNote = noteDraft.value.trim()

  if (!targetItem) {
    return false
  }

  if (targetItem.note === normalizedNote) {
    noteSaveStatus.value = noteStorageAvailable.value ? 'saved' : 'memory'
    return true
  }

  noteSaveStatus.value = 'saving'
  const persisted = practiceListsStore.updateProblemNote(
    activeNoteListId.value,
    activeNoteProblemId.value,
    normalizedNote,
  )

  noteStorageAvailable.value = persisted

  noteSaveStatus.value = persisted ? 'saved' : 'memory'
  return persisted
}

function updateNoteDraft(value) {
  noteDraft.value = String(value ?? '')
  noteSaveStatus.value = 'saving'
  clearNoteAutosaveTimer()
  noteAutosaveTimer = window.setTimeout(persistActiveNote, NOTE_AUTOSAVE_DELAY)
}

function resetNoteWorkspace({ save = true } = {}) {
  if (save) {
    persistActiveNote()
  } else {
    clearNoteAutosaveTimer()
  }

  activeNoteListId.value = ''
  activeNoteProblemId.value = ''
  noteDraft.value = ''
  noteSaveStatus.value = noteStorageAvailable.value ? 'saved' : 'memory'
}

function openNoteWorkspace(entry, { toggle = true } = {}) {
  if (!practiceList.value || !entry) {
    return
  }

  if (toggle && activeNoteProblemId.value === entry.item.problemId) {
    resetNoteWorkspace()
    return
  }

  persistActiveNote()
  activeNoteListId.value = practiceList.value.id
  activeNoteProblemId.value = entry.item.problemId
  noteDraft.value = String(entry.item.note ?? '')
  noteSaveStatus.value = noteStorageAvailable.value ? 'saved' : 'memory'
}

function openAdjacentNoteWorkspace(offset) {
  const targetEntry = problemEntries.value[activeNoteIndex.value + offset]

  if (targetEntry) {
    openNoteWorkspace(targetEntry, { toggle: false })
  }
}

function finishProblemDrag() {
  draggedProblemId.value = ''
  dragTargetProblemId.value = ''
  dragTargetPosition.value = ''
}

function startProblemDrag(problemId, event) {
  draggedProblemId.value = problemId
  dragTargetProblemId.value = ''
  dragTargetPosition.value = ''

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', problemId)
  }
}

function updateProblemDragTarget(problemId, event) {
  if (!draggedProblemId.value || draggedProblemId.value === problemId) {
    dragTargetProblemId.value = ''
    dragTargetPosition.value = ''
    return
  }

  const targetBounds = event.currentTarget.getBoundingClientRect()
  dragTargetProblemId.value = problemId
  dragTargetPosition.value =
    event.clientY < targetBounds.top + targetBounds.height / 2 ? 'before' : 'after'

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function dropProblem(targetProblemId) {
  const draggedIndex = problemEntries.value.findIndex(
    (entry) => entry.item.problemId === draggedProblemId.value,
  )
  const targetIndex = problemEntries.value.findIndex(
    (entry) => entry.item.problemId === targetProblemId,
  )
  const dropIndex = getPracticeListDropIndex(
    draggedIndex,
    targetIndex,
    dragTargetPosition.value,
    problemEntries.value.length,
  )
  const problemId = draggedProblemId.value

  finishProblemDrag()

  if (problemId && dropIndex !== draggedIndex) {
    moveProblem(problemId, dropIndex)
  }
}

function importProblemsById() {
  if (!practiceList.value) {
    return
  }

  const { requestedProblemIds, unknownProblemIds, validProblemIds } = parsePracticeListProblemIds(
    problemImportValue.value,
    PROBLEMS_PROTOTYPE_ITEMS,
  )

  if (requestedProblemIds.length === 0) {
    problemImportMessage.value = '请输入至少一个题目编号。'
    problemImportStatus.value = 'warning'
    return
  }

  const addedProblemIds = practiceListsStore.addProblemsToPracticeList(
    practiceList.value.id,
    validProblemIds,
  )
  const duplicateCount = validProblemIds.length - addedProblemIds.length
  const resultMessages = []

  if (addedProblemIds.length > 0) {
    resultMessages.push(`已添加 ${addedProblemIds.length} 道题`)
  }

  if (duplicateCount > 0) {
    resultMessages.push(`${duplicateCount} 道题已在题单中`)
  }

  if (unknownProblemIds.length > 0) {
    resultMessages.push(`未找到：${unknownProblemIds.join('、')}`)
  }

  problemImportMessage.value = resultMessages.join('；')
  problemImportStatus.value = addedProblemIds.length > 0 ? 'success' : 'warning'
  problemImportValue.value = unknownProblemIds.join(' ')

  if (addedProblemIds.length > 0) {
    showOperationFeedback(`已向题单添加 ${addedProblemIds.length} 道题`)
  }
}

async function startPracticeListPrint(entries, title) {
  persistActiveNote()

  const printableEntries = entries.filter((entry) => entry.problem)

  if (
    !practiceList.value ||
    printableEntries.length === 0 ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    showOperationFeedback('题单还没有可打印的题目')
    return
  }

  const hasSelectedProblemContent = Object.values(printOptions.value).some(Boolean)
  const hasPrintableNotes =
    includeNotes.value && printableEntries.some((entry) => Boolean(entry.item.note))

  if (!hasSelectedProblemContent && !hasPrintableNotes) {
    showOperationFeedback('请先在“个性化设置”中至少选择一项打印内容')
    return
  }

  const entriesToPrint = hasSelectedProblemContent
    ? printableEntries
    : printableEntries.filter((entry) => entry.item.note)

  const result = await openProblemPrintDialog({
    documentTitle: title,
    entries: entriesToPrint.map((entry) => ({
      key: entry.item.problemId,
      note: includeNotes.value ? entry.item.note : '',
      problem: {
        ...entry.problem,
        content: formatPracticeListProblemContent(entry.problem.content, entry.position),
      },
    })),
    header: { eyebrow: '高考数学题单', title: practiceList.value.title },
    includeHeader: includePrintHeader.value,
    options: printOptions.value,
    pageLayout: printPageLayout.value,
  })

  if (result.reason === 'print-unavailable') {
    showOperationFeedback('无法打开打印窗口，请检查浏览器设置')
  }
}

function printCurrentPracticeList() {
  return startPracticeListPrint(
    problemEntries.value,
    `高考数学题单-${practiceList.value?.title ?? '题单'}`,
  )
}

function printSingleProblem(entry) {
  if (!entry?.problem) {
    showOperationFeedback('当前题目数据不可用，无法打印')
    return
  }

  return startPracticeListPrint([entry], `高考数学单题练习-${entry.item.problemId}`)
}

async function shareCurrentPracticeList() {
  if (!practiceList.value || problemEntries.value.length === 0) {
    showOperationFeedback('题单还没有可分享的题目')
    return
  }

  try {
    await sharePracticeList(problemEntries.value)
    showOperationFeedback('题库编号已复制，可直接粘贴到“按题号导入”')
  } catch {
    showOperationFeedback('复制失败，请检查剪贴板权限')
  }
}

watch(
  () => props.practiceListId,
  () => {
    closeManagementMenu()
    resetNoteWorkspace()
    finishPrint()
    finishProblemDrag()
    editDialogOpen.value = false
    pendingConfirmation.value = null
    problemImportMessage.value = ''
    problemImportStatus.value = ''
    problemImportValue.value = ''
    exitBatchMode()
    window.clearTimeout(operationFeedbackTimer)
    operationFeedbackMessage.value = ''
  },
)

watch(viewMode, (nextViewMode) => {
  if (nextViewMode === 'preview-view') {
    exitBatchMode()
  }

  if (nextViewMode === 'preview-view' && activeNoteProblemId.value) {
    resetNoteWorkspace()
  }
})

onMounted(() => {
  document.addEventListener('pointerdown', handleManagementMenuPointerDown)
  document.addEventListener('keydown', handleManagementMenuKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleManagementMenuPointerDown)
  document.removeEventListener('keydown', handleManagementMenuKeydown)
  resetNoteWorkspace()
  window.clearTimeout(operationFeedbackTimer)
  finishProblemDrag()
  finishPrint()
})
</script>

<template>
  <div class="problems-page training-page training-detail-page">
    <main class="training-detail-main">
      <RouterLink class="training-back-link" :to="{ name: 'training', query: { tab: 'mine' } }">
        ← 返回我的题单
      </RouterLink>

      <section v-if="!practiceList" class="training-route-state" role="alert">
        <span class="training-empty-mark" aria-hidden="true">空</span>
        <h1>找不到这份题单</h1>
        <p>题单可能已经删除，或者当前链接不属于此浏览器中的本地题单。</p>
        <RouterLink
          class="training-primary-action"
          :to="{ name: 'training', query: { tab: 'mine' } }"
        >
          返回题单首页
        </RouterLink>
      </section>

      <template v-else>
        <header class="training-detail-header">
          <div class="training-detail-heading">
            <div class="training-detail-labels">
              <span>个人题单</span>
              <span v-if="isDefaultPracticeList" class="is-default">默认题单</span>
            </div>
            <h1>{{ practiceList.title }}</h1>
            <p v-if="practiceList.description">{{ practiceList.description }}</p>
          </div>

          <dl class="training-detail-summary" aria-label="题单统计">
            <div>
              <dt>题数</dt>
              <dd>{{ practiceList.items.length }}</dd>
            </div>
            <div>
              <dt>已做</dt>
              <dd>{{ completedPracticeListCount }}</dd>
            </div>
          </dl>
        </header>

        <div class="training-detail-layout">
          <section class="training-detail-content" aria-labelledby="training-detail-problems-title">
            <header class="training-detail-content-header">
              <div>
                <h2 id="training-detail-problems-title">题目与备注</h2>
              </div>
              <div class="training-detail-content-tools">
                <div class="training-detail-view-mode">
                  <span>浏览方式</span>
                  <div class="bank-header-view-switch" aria-label="题单题目展示方式">
                    <button
                      type="button"
                      class="bank-header-view-switch-button"
                      :class="{ 'is-active': viewMode === 'preview-view' }"
                      :aria-pressed="viewMode === 'preview-view'"
                      @click="setViewMode('preview-view')"
                    >
                      完整
                    </button>
                    <button
                      type="button"
                      class="bank-header-view-switch-button"
                      :class="{ 'is-active': viewMode === 'list-view' }"
                      :aria-pressed="viewMode === 'list-view'"
                      @click="setViewMode('list-view')"
                    >
                      简略
                    </button>
                  </div>
                </div>
                <TrainingPersonalizationSettings
                  :action-confirmations="actionConfirmations"
                  :include-notes="includeNotes"
                  :include-print-header="includePrintHeader"
                  :print-option-options="PROBLEMS_PRINT_OPTION_OPTIONS"
                  :print-options="printOptions"
                  :print-page-layout="printPageLayout"
                  :print-page-layout-options="PRACTICE_LIST_PRINT_PAGE_LAYOUTS"
                  @action-confirmation-change="setActionConfirmation($event.name, $event.enabled)"
                  @include-notes-change="setIncludeNotes"
                  @include-print-header-change="setIncludePrintHeader"
                  @print-option-change="setPrintOption($event.name, $event.visible)"
                  @print-page-layout-change="setPrintPageLayout"
                  @print-preset-change="setPrintPreset"
                />
                <details ref="managementMenu" class="training-detail-more-menu">
                  <summary aria-label="更多题单操作" title="更多">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                  </summary>
                  <div role="group" aria-label="题单管理操作">
                    <button
                      type="button"
                      :disabled="isDefaultPracticeList"
                      @click="setAsDefaultPracticeList"
                    >
                      {{ isDefaultPracticeList ? '当前默认题单' : '设为默认题单' }}
                    </button>
                    <button type="button" @click="openEditDialog">编辑题单信息</button>
                    <button type="button" class="is-danger-text" @click="requestDeletePracticeList">
                      删除题单
                    </button>
                  </div>
                </details>
              </div>
            </header>

            <form
              v-if="viewMode === 'list-view'"
              class="training-detail-import"
              @submit.prevent="importProblemsById"
            >
              <label for="training-problem-import">按题号导入</label>
              <div class="training-detail-import-control">
                <input
                  id="training-problem-import"
                  v-model="problemImportValue"
                  type="text"
                  inputmode="text"
                  autocomplete="off"
                  :aria-describedby="
                    problemImportMessage ? 'training-problem-import-result' : undefined
                  "
                  placeholder="例如：P10001, P10002"
                  @input="problemImportMessage = ''"
                />
                <button type="submit" :disabled="!problemImportValue.trim()">添加</button>
              </div>
              <p
                v-if="problemImportMessage"
                id="training-problem-import-result"
                class="training-detail-import-result"
                :class="`is-${problemImportStatus}`"
                role="status"
                aria-live="polite"
              >
                {{ problemImportMessage }}
              </p>
            </form>

            <div
              v-if="problemEntries.length"
              :id="viewMode"
              class="training-detail-problem-list"
              :class="`is-${viewMode}`"
            >
              <TrainingProblemItem
                v-for="(entry, index) in problemEntries"
                :key="entry.item.problemId"
                :index="index"
                :item="entry.item"
                :note-active="activeNoteProblemId === entry.item.problemId"
                :problem="entry.problem"
                :selected="selectedProblemIds.includes(entry.item.problemId)"
                :selection-mode="batchMode"
                :completed="completedProblemIds.includes(entry.item.problemId)"
                :dragging="draggedProblemId === entry.item.problemId"
                :drop-position="
                  dragTargetProblemId === entry.item.problemId ? dragTargetPosition : ''
                "
                :total="problemEntries.length"
                :view-mode="viewMode"
                @drag-end="finishProblemDrag"
                @drag-over="updateProblemDragTarget(entry.item.problemId, $event)"
                @drag-start="startProblemDrag(entry.item.problemId, $event)"
                @drop="dropProblem(entry.item.problemId)"
                @edit-note="openNoteWorkspace(entry)"
                @move="moveProblem(entry.item.problemId, $event)"
                @print="printSingleProblem(entry)"
                @remove="requestRemoveProblem(entry.item.problemId)"
                @selection-change="setProblemSelected(entry.item.problemId, $event)"
                @toggle-completed="updateProblemCompleted(entry.item.problemId, $event)"
              />
            </div>

            <div
              v-if="viewMode === 'list-view' && problemEntries.length"
              class="training-detail-batch-toolbar"
              :class="{ 'is-active': batchMode }"
              aria-label="题目批量操作"
            >
              <button v-if="!batchMode" type="button" @click="enterBatchMode">多选</button>
              <template v-else>
                <button type="button" @click="exitBatchMode">返回</button>
                <span aria-live="polite">已选择 {{ selectedProblemIds.length }}</span>
                <button type="button" :disabled="allProblemsSelected" @click="selectAllProblems">
                  全选
                </button>
                <button
                  type="button"
                  :disabled="selectedProblemIds.length === 0"
                  @click="clearProblemSelection"
                >
                  清除
                </button>
                <div class="training-detail-batch-actions">
                  <button
                    type="button"
                    :disabled="selectedProblemIds.length === 0"
                    @click="printSelectedProblems"
                  >
                    打印所选
                  </button>
                  <button
                    type="button"
                    class="is-danger-text"
                    :disabled="selectedProblemIds.length === 0"
                    @click="requestRemoveSelectedProblems"
                  >
                    移出题单
                  </button>
                </div>
              </template>
            </div>

            <div v-if="!problemEntries.length" class="training-detail-empty">
              <span class="training-empty-mark" aria-hidden="true">题</span>
              <h2>这份题单还没有题目</h2>
              <p>前往题库选择需要练习的题目，它们会加入当前默认题单。</p>
              <RouterLink class="training-primary-action" to="/problems">前往题库</RouterLink>
            </div>
          </section>

          <aside class="training-detail-sidebar" aria-label="题单信息与操作">
            <TrainingNoteWorkspace
              v-if="activeNoteEntry"
              :draft="noteDraft"
              :entry="activeNoteEntry"
              :has-next="hasNextNoteEntry"
              :has-previous="hasPreviousNoteEntry"
              :save-status="noteSaveStatus"
              @close="resetNoteWorkspace"
              @next="openAdjacentNoteWorkspace(1)"
              @previous="openAdjacentNoteWorkspace(-1)"
              @save-now="persistActiveNote"
              @update:draft="updateNoteDraft"
            />

            <section class="training-detail-sidebar-card">
              <header>
                <h2>题单信息</h2>
                <span>{{ isDefaultPracticeList ? '默认题单' : '个人题单' }}</span>
              </header>
              <dl class="training-detail-sidebar-facts">
                <div>
                  <dt>保存方式</dt>
                  <dd class="is-text">当前浏览器</dd>
                </div>
                <div>
                  <dt>个人备注</dt>
                  <dd>{{ noteCount }}</dd>
                </div>
              </dl>
              <div class="training-detail-progress">
                <p>
                  <span>已做进度</span>
                  <strong
                    >{{ completedPracticeListCount }} / {{ practiceList.items.length }}</strong
                  >
                </p>
                <div
                  class="training-detail-progress-track"
                  role="progressbar"
                  aria-label="题单已做进度"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="completionRate"
                >
                  <span :style="{ width: `${completionRate}%` }"></span>
                </div>
              </div>
            </section>

            <section class="training-detail-sidebar-card">
              <header>
                <h2>使用题单</h2>
              </header>
              <RouterLink
                v-if="nextPracticeEntry"
                class="training-primary-action training-detail-study-action"
                :to="{
                  name: 'question',
                  params: { problemNumber: nextPracticeEntry.item.problemId },
                }"
              >
                {{ practiceActionLabel }}
              </RouterLink>
              <div class="training-detail-output-actions" role="group" aria-label="题单输出操作">
                <button
                  type="button"
                  :disabled="problemEntries.length === 0"
                  @click="printCurrentPracticeList"
                >
                  打印题单
                </button>
                <button
                  type="button"
                  :disabled="problemEntries.length === 0"
                  @click="shareCurrentPracticeList"
                >
                  复制题号
                </button>
              </div>
            </section>
          </aside>
        </div>
      </template>
    </main>

    <TrainingEditDialog
      :open="editDialogOpen"
      :practice-list="practiceList"
      @cancel="closeEditDialog"
      @save="savePracticeList"
    />

    <TrainingConfirmDialog
      :open="Boolean(pendingConfirmation)"
      :title="pendingConfirmation?.title"
      :description="pendingConfirmation?.description"
      :confirm-label="pendingConfirmation?.confirmLabel"
      @cancel="cancelPendingConfirmation"
      @confirm="confirmPendingAction"
    />

    <p
      v-show="operationFeedbackMessage"
      class="training-operation-feedback"
      :class="{ 'is-visible': operationFeedbackMessage }"
      role="status"
      aria-live="polite"
    >
      {{ operationFeedbackMessage }}
    </p>
  </div>
</template>
