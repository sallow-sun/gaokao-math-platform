import { computed, nextTick, ref, unref, watch } from 'vue'

export const PROBLEMS_PAGE_SIZE = 20

export function getNextProblemsLimit(currentLimit, totalCount, pageSize = PROBLEMS_PAGE_SIZE) {
  const safeCurrentLimit = Math.max(0, Number(currentLimit) || 0)
  const safeTotalCount = Math.max(0, Number(totalCount) || 0)
  const safePageSize = Math.max(1, Number(pageSize) || PROBLEMS_PAGE_SIZE)

  return Math.min(safeCurrentLimit + safePageSize, safeTotalCount)
}

export function useProblemsInfiniteList(items, pageSize = PROBLEMS_PAGE_SIZE) {
  const visibleLimit = ref(pageSize)
  const isLoadingMore = ref(false)
  const loadedProblems = computed(() => unref(items).slice(0, visibleLimit.value))
  const hasMoreProblems = computed(() => loadedProblems.value.length < unref(items).length)

  function resetLoadedProblems() {
    visibleLimit.value = pageSize
    isLoadingMore.value = false
  }

  async function loadMoreProblems() {
    if (isLoadingMore.value || !hasMoreProblems.value) {
      return
    }

    isLoadingMore.value = true
    await nextTick()
    visibleLimit.value = getNextProblemsLimit(visibleLimit.value, unref(items).length, pageSize)
    isLoadingMore.value = false
  }

  watch(
    () => unref(items),
    () => resetLoadedProblems(),
  )

  return {
    hasMoreProblems,
    isLoadingMore,
    loadedProblems,
    loadMoreProblems,
    resetLoadedProblems,
  }
}
