import { ref } from 'vue'

export function normalizeProblemIds(problemIds) {
  return Array.from(
    new Set(problemIds.map((problemId) => String(problemId ?? '').trim()).filter(Boolean)),
  )
}

export function updateSelectedProblemIds(currentIds, problemIds, selected) {
  const nextIds = new Set(normalizeProblemIds(currentIds))

  normalizeProblemIds(problemIds).forEach((problemId) => {
    if (selected) {
      nextIds.add(problemId)
    } else {
      nextIds.delete(problemId)
    }
  })

  return Array.from(nextIds)
}

export function useProblemsSelection() {
  const selectedProblemIds = ref([])

  function isProblemSelected(problemId) {
    return selectedProblemIds.value.includes(String(problemId))
  }

  function setProblemSelected(problemId, selected) {
    selectedProblemIds.value = updateSelectedProblemIds(
      selectedProblemIds.value,
      [problemId],
      selected,
    )
  }

  function setProblemsSelected(problemIds, selected) {
    selectedProblemIds.value = updateSelectedProblemIds(
      selectedProblemIds.value,
      problemIds,
      selected,
    )
  }

  function clearSelection() {
    selectedProblemIds.value = []
  }

  return {
    selectedProblemIds,
    clearSelection,
    isProblemSelected,
    setProblemSelected,
    setProblemsSelected,
  }
}
