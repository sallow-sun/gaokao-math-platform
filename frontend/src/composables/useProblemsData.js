import { computed, ref, unref, watch } from 'vue'
import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'
import { listProblems, normalizeApiProblem } from '../services/problemService.js'
import { filterAndSortPrototypeProblems } from './usePrototypeProblems.js'

export function useProblemsData({ keyword, levels, questionTypes, sort, sources, years }, pageSize) {
  const problems = ref([])
  const totalCount = ref(0)
  const currentPage = ref(0)
  const isLoading = ref(false)
  const isFallback = ref(false)
  const error = ref(null)
  let activeRequest = 0
  let controller = null

  const hasMoreProblems = computed(
    () => !isFallback.value && problems.value.length < totalCount.value,
  )

  function currentQuery(page) {
    return {
      keyword: unref(keyword),
      levels: unref(levels),
      types: unref(questionTypes),
      sort: unref(sort),
      sources: unref(sources),
      years: unref(years),
      page,
      pageSize,
    }
  }

  function useFallbackProblems(loadError) {
    const query = currentQuery(1)
    problems.value = filterAndSortPrototypeProblems(PROBLEMS_PROTOTYPE_ITEMS, {
      keyword: query.keyword,
      levels: query.levels,
      sources: query.sources,
      sort: query.sort,
      types: query.types,
      years: query.years,
    }).map(normalizeApiProblem)
    totalCount.value = problems.value.length
    currentPage.value = 1
    isFallback.value = true
    error.value = loadError
  }

  async function loadPage(page, { reset = false } = {}) {
    if ((!reset && isLoading.value) || (!reset && !hasMoreProblems.value)) {
      return
    }

    const requestId = ++activeRequest
    controller?.abort()
    controller = new AbortController()
    isLoading.value = true

    if (reset) {
      problems.value = []
      totalCount.value = 0
      currentPage.value = 0
      isFallback.value = false
      error.value = null
    }

    try {
      const result = await listProblems(currentQuery(page), { signal: controller.signal })
      if (requestId !== activeRequest) return

      problems.value = reset ? result.items : [...problems.value, ...result.items]
      totalCount.value = Number(result.pagination.total) || 0
      currentPage.value = Number(result.pagination.page) || page
      error.value = null
    } catch (loadError) {
      if (loadError?.name === 'AbortError' || requestId !== activeRequest) return

      if (reset) {
        useFallbackProblems(loadError)
      } else {
        error.value = loadError
      }
    } finally {
      if (requestId === activeRequest) {
        isLoading.value = false
      }
    }
  }

  function reloadProblems() {
    return loadPage(1, { reset: true })
  }

  function loadMoreProblems() {
    return loadPage(currentPage.value + 1)
  }

  watch(
    () => [
      unref(keyword),
      [...unref(levels)],
      [...unref(questionTypes)],
      unref(sort),
      [...unref(sources)],
      [...unref(years)],
    ],
    reloadProblems,
    { immediate: true },
  )

  return {
    error,
    hasMoreProblems,
    isFallback,
    isLoading,
    loadMoreProblems,
    problems,
    reloadProblems,
    totalCount,
  }
}
