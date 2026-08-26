import { computed, unref } from 'vue'
import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'

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
  const problem = computed(() => findPrototypeProblem(normalizedProblemNumber.value))

  return {
    error: computed(() => null),
    isLoading: computed(() => false),
    normalizedProblemNumber,
    problem,
  }
}
