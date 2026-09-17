import { computed, ref, unref, watch } from 'vue'
import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'
import { getProblem } from '../services/problemService.js'

export function normalizeProblemNumber(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

export function findPrototypeProblem(problemNumber, problems = PROBLEMS_PROTOTYPE_ITEMS) {
  const normalizedProblemNumber = normalizeProblemNumber(problemNumber)

  if (!normalizedProblemNumber) {
    return null
  }

  return (
    problems.find((problem) => normalizeProblemNumber(problem.id) === normalizedProblemNumber) ??
    null
  )
}

export function useQuestionData(problemNumber) {
  const normalizedProblemNumber = computed(() => normalizeProblemNumber(unref(problemNumber)))
  const problem = ref(null)
  const error = ref(null)
  const isLoading = ref(false)
  let controller = null

  watch(
    normalizedProblemNumber,
    async (nextProblemNumber) => {
      controller?.abort()
      const currentController = new AbortController()
      controller = currentController
      problem.value = null
      error.value = null

      if (!nextProblemNumber) {
        return
      }

      isLoading.value = true
      try {
        problem.value = await getProblem(nextProblemNumber, { signal: currentController.signal })
      } catch (loadError) {
        if (loadError?.name !== 'AbortError') {
          error.value = loadError?.status === 404 ? null : loadError
        }
      } finally {
        if (!currentController.signal.aborted) {
          isLoading.value = false
        }
      }
    },
    { immediate: true },
  )

  return {
    error,
    isLoading,
    normalizedProblemNumber,
    problem,
  }
}
