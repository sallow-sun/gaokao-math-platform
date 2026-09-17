import { computed } from 'vue'
import { usePracticeListsStore } from '../stores/practiceLists.js'
import { LEGACY_PRACTICE_LIST_STORAGE_KEY } from './usePracticeListsStorage.js'
import { normalizeProblemIds } from './useProblemsSelection.js'

export const PROBLEMS_PRACTICE_LIST_STORAGE_KEY = LEGACY_PRACTICE_LIST_STORAGE_KEY

export function normalizeProblemsPracticeList(value) {
  return Array.isArray(value) ? normalizeProblemIds(value) : []
}

export function mergeProblemsPracticeList(currentIds, problemIds) {
  const currentProblemIds = normalizeProblemsPracticeList(currentIds)
  const requestedProblemIds = Array.isArray(problemIds) ? problemIds : [problemIds]
  const nextProblemIds = normalizeProblemIds([...currentProblemIds, ...requestedProblemIds])

  return {
    newlyAddedProblemIds: nextProblemIds.filter(
      (problemId) => !currentProblemIds.includes(problemId),
    ),
    problemIds: nextProblemIds,
  }
}

export function useProblemsPracticeList() {
  const practiceListsStore = usePracticeListsStore()
  const practiceProblemIds = computed(() =>
    normalizeProblemIds(
      practiceListsStore.lists.flatMap((practiceList) =>
        practiceList.items.map((item) => item.problemId),
      ),
    ),
  )

  function isProblemInPracticeList(problemId) {
    return practiceProblemIds.value.includes(String(problemId))
  }

  async function addProblemsToPracticeList(problemIds) {
    let defaultPracticeList = practiceListsStore.getPracticeListById(
      practiceListsStore.defaultListId,
    )

    if (!defaultPracticeList) {
      defaultPracticeList = await practiceListsStore.createPracticeList({
        title: '默认题单',
        description: '从题库和题目详情页加入的题目',
      })
    }

    return practiceListsStore.addProblemsToPracticeList(defaultPracticeList.id, problemIds)
  }

  return {
    practiceProblemIds,
    addProblemsToPracticeList,
    isProblemInPracticeList,
  }
}
