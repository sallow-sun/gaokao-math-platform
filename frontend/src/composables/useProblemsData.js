import { computed, onBeforeUnmount, ref, unref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { lastProblemsVisit } from '../services/problemNavigation.js'
import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'
import { listProblems, normalizeApiProblem } from '../services/problemService.js'
import { filterAndSortPrototypeProblems } from './usePrototypeProblems.js'

// One short-lived, public-content snapshot for returning from a question detail.
// Never persist personal viewer state, answers or solutions in the list snapshot.
let returnSnapshot = null

export function useProblemsData(
  { keyword, levels, questionTypes, sort, sources, years, tags, learning, learned, chapters },
  pageSize,
) {
  const route = useRoute()
  const problems = ref([])
  const totalCount = ref(0)
  const currentPage = ref(0)
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const isFallback = ref(false)
  const error = ref(null)
  let activeRequest = 0
  let controller = null

  const hasMoreProblems = computed(
    () => !isFallback.value && problems.value.length < totalCount.value,
  )

  function currentQuery(page) {
    return {
      tags: unref(tags),
      learning: unref(learning),
      learned: unref(learned),
      chapters: unref(chapters),
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
    if (query.learning || query.chapters?.length || query.tags?.length) {
      problems.value = []
      totalCount.value = 0
      currentPage.value = 0
      isFallback.value = false
      error.value = loadError
      return
    }
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

  async function loadPage(page, { reset = false, restorePages = 1 } = {}) {
    if ((!reset && isLoading.value) || (!reset && !hasMoreProblems.value)) {
      return
    }

    const requestId = ++activeRequest
    controller?.abort()
    controller = new AbortController()
    isLoading.value = true
    isRefreshing.value = reset && problems.value.length > 0

    if (reset) {
      isFallback.value = false
      error.value = null
    }

    try {
      const pages = await Promise.all(
        Array.from({ length: restorePages }, (_, i) =>
          listProblems(currentQuery(page + i), { signal: controller.signal }),
        ),
      )
      const result = pages[0]
      if (requestId !== activeRequest) return

      problems.value = reset ? pages.flatMap((p) => p.items) : [...problems.value, ...result.items]
      totalCount.value = Number(result.pagination.total) || 0
      currentPage.value = Math.max(
        1,
        Math.min(page + restorePages - 1, Math.ceil(totalCount.value / pageSize)),
      )
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
        isRefreshing.value = false
      }
    }
  }

  function reloadProblems() {
    returnSnapshot = null
    return loadPage(1, { reset: true })
  }

  function loadQuery() {
    const saved = returnSnapshot
    returnSnapshot = null
    if (saved && saved.key === JSON.stringify(currentQuery(1)) && Date.now() - saved.at < 120000) {
      problems.value = saved.items
      totalCount.value = saved.total
      currentPage.value = saved.page
      return loadPage(1, { reset: true, restorePages: saved.page })
    }
    return loadPage(1, { reset: true })
  }

  onBeforeRouteLeave((to) => {
    Object.assign(lastProblemsVisit, { path: route.fullPath, top: window.scrollY, at: Date.now() })
    returnSnapshot = null
    if (
      to.name === 'question' &&
      !isLoading.value &&
      !error.value &&
      !isFallback.value &&
      currentPage.value > 0 &&
      problems.value.length <= 200
    ) {
      returnSnapshot = {
        key: JSON.stringify(currentQuery(1)),
        at: Date.now(),
        total: totalCount.value,
        page: currentPage.value,
        items: problems.value.map((problem) => {
          const copy = { ...problem }
          delete copy.viewerState
          delete copy.answer
          delete copy.solution
          return copy
        }),
      }
    }
  })
  onBeforeUnmount(() => {
    activeRequest++
    controller?.abort()
  })

  function loadMoreProblems() {
    return loadPage(currentPage.value + 1)
  }

  watch(
    () => [
      [...(unref(tags) || [])],
      unref(learning),
      [...(unref(learned) || [])],
      [...(unref(chapters) || [])],
      unref(keyword),
      [...unref(levels)],
      [...unref(questionTypes)],
      unref(sort),
      [...unref(sources)],
      [...unref(years)],
    ],
    loadQuery,
    { immediate: true },
  )

  return {
    error,
    hasMoreProblems,
    isFallback,
    isLoading,
    isRefreshing,
    loadMoreProblems,
    problems,
    reloadProblems,
    totalCount,
  }
}
