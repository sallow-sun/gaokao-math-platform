import { ref } from 'vue'
import { normalizeProblemIds } from './useProblemsSelection.js'
import { apiRequest } from '../services/apiClient.js'
import { usePracticeListsStore } from '../stores/practiceLists.js'

export const PROBLEMS_COMPLETED_STORAGE_KEY = 'problem-bank-completed-problems'
export const PROBLEMS_FAVORITE_STORAGE_KEY = 'problem-bank-favorite-problems'
const sharedCompletedProblemIds = ref(readProblemIds(PROBLEMS_COMPLETED_STORAGE_KEY, []))
const sharedFavoriteProblemIds = ref(readProblemIds(PROBLEMS_FAVORITE_STORAGE_KEY, []))

export function normalizeProblemsUserMarks(value) {
  return Array.isArray(value) ? normalizeProblemIds(value) : []
}

function readProblemIds(key, fallbackIds) {
  if (typeof window === 'undefined') {
    return normalizeProblemsUserMarks(fallbackIds)
  }

  try {
    const savedValue = window.localStorage.getItem(key)

    return savedValue === null
      ? normalizeProblemsUserMarks(fallbackIds)
      : normalizeProblemsUserMarks(JSON.parse(savedValue))
  } catch {
    return normalizeProblemsUserMarks(fallbackIds)
  }
}

function writeProblemIds(key, problemIds) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(problemIds))
  } catch {
    // 本地存储不可用时，本页内的已做和收藏状态仍然可以正常使用。
  }
}

export function updateProblemsUserMarks(currentIds, problemId, marked) {
  const normalizedProblemId = String(problemId ?? '').trim()

  if (!normalizedProblemId) {
    return normalizeProblemsUserMarks(currentIds)
  }

  const nextIds = new Set(normalizeProblemsUserMarks(currentIds))

  if (marked) {
    nextIds.add(normalizedProblemId)
  } else {
    nextIds.delete(normalizedProblemId)
  }

  return Array.from(nextIds)
}

export function useProblemsUserMarks(problems = []) {
  const practiceListsStore = usePracticeListsStore()
  const completedProblemIds = sharedCompletedProblemIds
  const favoriteProblemIds = sharedFavoriteProblemIds

  function syncMarksFromProblems(items = problems) {
    if (!Array.isArray(items)) return
    items.forEach((problem) => {
      if (!problem?.id || !problem.viewerState) return
      completedProblemIds.value = updateProblemsUserMarks(
        completedProblemIds.value,
        problem.id,
        Boolean(problem.viewerState.completed),
      )
      favoriteProblemIds.value = updateProblemsUserMarks(
        favoriteProblemIds.value,
        problem.id,
        Boolean(problem.viewerState.favorite),
      )
    })
    writeProblemIds(PROBLEMS_COMPLETED_STORAGE_KEY, completedProblemIds.value)
    writeProblemIds(PROBLEMS_FAVORITE_STORAGE_KEY, favoriteProblemIds.value)
  }

  syncMarksFromProblems(problems)

  function syncProblemState(problemId, body) {
    if (!practiceListsStore.authenticated) return
    void apiRequest(`/api/v1/users/me/problem-states/${encodeURIComponent(problemId)}`, {
      method: 'PATCH',
      body,
    }).catch(() => {})
  }

  function setProblemCompleted(problemId, completed) {
    completedProblemIds.value = updateProblemsUserMarks(
      completedProblemIds.value,
      problemId,
      completed,
    )
    writeProblemIds(PROBLEMS_COMPLETED_STORAGE_KEY, completedProblemIds.value)
    syncProblemState(problemId, { completed })
  }

  function setProblemFavorite(problemId, favorite) {
    favoriteProblemIds.value = updateProblemsUserMarks(
      favoriteProblemIds.value,
      problemId,
      favorite,
    )
    writeProblemIds(PROBLEMS_FAVORITE_STORAGE_KEY, favoriteProblemIds.value)
    syncProblemState(problemId, { favorite })
  }

  return {
    completedProblemIds,
    favoriteProblemIds,
    setProblemCompleted,
    setProblemFavorite,
    syncMarksFromProblems,
  }
}
