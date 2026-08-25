import { ref } from 'vue'
import { normalizeProblemIds } from './useProblemsSelection.js'

export const PROBLEMS_PRACTICE_LIST_STORAGE_KEY = 'problem-bank-practice-list'

export function normalizeProblemsPracticeList(value) {
  return Array.isArray(value) ? normalizeProblemIds(value) : []
}

function readPracticeList() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    return normalizeProblemsPracticeList(
      JSON.parse(window.localStorage.getItem(PROBLEMS_PRACTICE_LIST_STORAGE_KEY)),
    )
  } catch {
    return []
  }
}

function writePracticeList(problemIds) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(PROBLEMS_PRACTICE_LIST_STORAGE_KEY, JSON.stringify(problemIds))
  } catch {
    // 本地存储不可用时，本页内的题单状态仍然可以正常使用。
  }
}

export function mergeProblemsPracticeList(currentIds, problemIds) {
  const currentProblemIds = normalizeProblemsPracticeList(currentIds)
  const nextProblemIds = normalizeProblemIds([...currentProblemIds, ...problemIds])

  return {
    newlyAddedProblemIds: nextProblemIds.filter(
      (problemId) => !currentProblemIds.includes(problemId),
    ),
    problemIds: nextProblemIds,
  }
}

export function useProblemsPracticeList() {
  const practiceProblemIds = ref(readPracticeList())

  function isProblemInPracticeList(problemId) {
    return practiceProblemIds.value.includes(String(problemId))
  }

  function addProblemsToPracticeList(problemIds) {
    const result = mergeProblemsPracticeList(practiceProblemIds.value, problemIds)
    practiceProblemIds.value = result.problemIds
    writePracticeList(practiceProblemIds.value)

    return result.newlyAddedProblemIds
  }

  return {
    practiceProblemIds,
    addProblemsToPracticeList,
    isProblemInPracticeList,
  }
}
