import { ref } from 'vue'
import { normalizeProblemIds } from './useProblemsSelection.js'

export const PROBLEMS_COMPLETED_STORAGE_KEY = 'problem-bank-completed-problems'
export const PROBLEMS_FAVORITE_STORAGE_KEY = 'problem-bank-favorite-problems'

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
  const defaultCompletedProblemIds = problems
    .filter((problem) => problem.completed)
    .map((problem) => problem.id)
  const completedProblemIds = ref(
    readProblemIds(PROBLEMS_COMPLETED_STORAGE_KEY, defaultCompletedProblemIds),
  )
  const favoriteProblemIds = ref(readProblemIds(PROBLEMS_FAVORITE_STORAGE_KEY, []))

  function setProblemCompleted(problemId, completed) {
    completedProblemIds.value = updateProblemsUserMarks(
      completedProblemIds.value,
      problemId,
      completed,
    )
    writeProblemIds(PROBLEMS_COMPLETED_STORAGE_KEY, completedProblemIds.value)
  }

  function setProblemFavorite(problemId, favorite) {
    favoriteProblemIds.value = updateProblemsUserMarks(
      favoriteProblemIds.value,
      problemId,
      favorite,
    )
    writeProblemIds(PROBLEMS_FAVORITE_STORAGE_KEY, favoriteProblemIds.value)
  }

  return {
    completedProblemIds,
    favoriteProblemIds,
    setProblemCompleted,
    setProblemFavorite,
  }
}
