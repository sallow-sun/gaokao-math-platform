import { computed, ref } from 'vue'
import { usePracticeListsStore } from '../stores/practiceLists.js'
import { normalizeProblemIds } from './useProblemsSelection.js'

export function usePracticeListPicker() {
  const practiceListsStore = usePracticeListsStore()
  const pickerOpen = ref(false)
  const pickerMode = ref('manage')
  const pickerProblemIds = ref([])
  const selectedPracticeListIds = ref([])

  const practiceLists = computed(() => practiceListsStore.lists)
  const defaultPracticeListId = computed(() => practiceListsStore.defaultListId)

  function closePracticeListPicker() {
    pickerOpen.value = false
    pickerProblemIds.value = []
    selectedPracticeListIds.value = []
  }

  function openPracticeListPickerForProblem(problemId) {
    const [normalizedProblemId] = normalizeProblemIds([problemId])

    if (!normalizedProblemId) {
      return false
    }

    pickerMode.value = 'manage'
    pickerProblemIds.value = [normalizedProblemId]
    selectedPracticeListIds.value = practiceListsStore
      .getPracticeListsForProblem(normalizedProblemId)
      .map((practiceList) => practiceList.id)
    pickerOpen.value = true
    return true
  }

  function openPracticeListPickerForProblems(problemIds) {
    const normalizedProblemIds = normalizeProblemIds(
      Array.isArray(problemIds) ? problemIds : [problemIds],
    )

    if (normalizedProblemIds.length === 0) {
      return false
    }

    pickerMode.value = 'add'
    pickerProblemIds.value = normalizedProblemIds
    selectedPracticeListIds.value = practiceListsStore.defaultListId
      ? [practiceListsStore.defaultListId]
      : []
    pickerOpen.value = true
    return true
  }

  function setPracticeListSelected({ listId, selected }) {
    const normalizedListId = String(listId ?? '').trim()

    if (!normalizedListId || !practiceListsStore.getPracticeListById(normalizedListId)) {
      return
    }

    const nextListIds = new Set(selectedPracticeListIds.value)

    if (selected) {
      nextListIds.add(normalizedListId)
    } else {
      nextListIds.delete(normalizedListId)
    }

    selectedPracticeListIds.value = Array.from(nextListIds)
  }

  async function createPracticeListFromPicker(formValue) {
    const practiceList = await practiceListsStore.createPracticeList(formValue)
    selectedPracticeListIds.value = [...selectedPracticeListIds.value, practiceList.id]
    return practiceList
  }

  async function applyPracticeListSelection() {
    const selectedListIds = new Set(selectedPracticeListIds.value)
    let addedMembershipCount = 0
    let removedMembershipCount = 0

    if (pickerMode.value === 'manage') {
      const [problemId] = pickerProblemIds.value

      for (const practiceList of practiceListsStore.lists) {
        const currentlyIncluded = practiceList.items.some((item) => item.problemId === problemId)
        const shouldBeIncluded = selectedListIds.has(practiceList.id)

        if (shouldBeIncluded && !currentlyIncluded) {
          addedMembershipCount += (
            await practiceListsStore.addProblemsToPracticeList(practiceList.id, [problemId])
          ).length
        } else if (!shouldBeIncluded && currentlyIncluded) {
          const removed = await practiceListsStore.removeProblemFromPracticeList(
            practiceList.id,
            problemId,
          )
          removedMembershipCount += removed ? 1 : 0
        }
      }
    } else {
      for (const listId of selectedPracticeListIds.value) {
        addedMembershipCount += (
          await practiceListsStore.addProblemsToPracticeList(
          listId,
          pickerProblemIds.value,
          )
        ).length
      }
    }

    const result = {
      addedMembershipCount,
      mode: pickerMode.value,
      problemCount: pickerProblemIds.value.length,
      problemId: pickerProblemIds.value[0] ?? '',
      removedMembershipCount,
      selectedListCount: selectedPracticeListIds.value.length,
    }

    closePracticeListPicker()
    return result
  }

  return {
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
  }
}
