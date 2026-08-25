import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DEFAULT_PROBLEMS_SORT,
  normalizeProblemLevel,
  normalizeProblemSource,
  normalizeProblemSort,
  normalizeProblemType,
  normalizeProblemYear,
} from '../config/problems.js'

function readSingleQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0] || ''
  }

  return typeof value === 'string' ? value : ''
}

export function normalizeProblemsQueryValues(value, normalizeValue) {
  const queryValues = Array.isArray(value) ? value : [value]
  const normalizedValues = queryValues
    .filter((queryValue) => typeof queryValue === 'string' && queryValue)
    .map((queryValue) => normalizeValue(queryValue))
    .filter(Boolean)

  return [...new Set(normalizedValues)]
}

export function createProblemsFilterQueryValue(value, normalizeValue) {
  const normalizedValues = normalizeProblemsQueryValues(value, normalizeValue)

  if (!normalizedValues.length) {
    return undefined
  }

  return Array.isArray(value) ? normalizedValues : normalizedValues[0]
}

export function useProblemsQuery() {
  const route = useRoute()
  const router = useRouter()

  const keyword = computed(() => readSingleQueryValue(route.query.keyword))
  const levels = computed(() =>
    normalizeProblemsQueryValues(route.query.level, normalizeProblemLevel),
  )
  const questionTypes = computed(() =>
    normalizeProblemsQueryValues(route.query.type, normalizeProblemType),
  )
  const sources = computed(() =>
    normalizeProblemsQueryValues(route.query.source, normalizeProblemSource),
  )
  const years = computed(() => normalizeProblemsQueryValues(route.query.year, normalizeProblemYear))
  const level = computed(() => levels.value[0] || '')
  const questionType = computed(() => questionTypes.value[0] || '')
  const source = computed(() => sources.value[0] || '')
  const sort = computed(() => normalizeProblemSort(readSingleQueryValue(route.query.sort)))
  const year = computed(() => years.value[0] || '')

  function updateKeyword(nextKeyword) {
    const query = { ...route.query }

    if (nextKeyword) {
      query.keyword = nextKeyword
    } else {
      delete query.keyword
    }

    delete query.page
    router.push({ name: 'problems', query })
  }

  function updateSort(nextSort) {
    const query = { ...route.query }
    const normalizedSort = normalizeProblemSort(nextSort)

    if (normalizedSort === DEFAULT_PROBLEMS_SORT) {
      delete query.sort
    } else {
      query.sort = normalizedSort
    }

    delete query.page
    router.push({ name: 'problems', query })
  }

  function updateFilter(queryKey, nextValue, normalizeValue) {
    const query = { ...route.query }
    const queryValue = createProblemsFilterQueryValue(nextValue, normalizeValue)

    if (queryValue === undefined) {
      delete query[queryKey]
    } else {
      query[queryKey] = queryValue
    }

    delete query.page
    router.push({ name: 'problems', query })
  }

  function updateLevel(nextLevel) {
    updateFilter('level', nextLevel, normalizeProblemLevel)
  }

  function updateYear(nextYear) {
    updateFilter('year', nextYear, normalizeProblemYear)
  }

  function updateSource(nextSource) {
    updateFilter('source', nextSource, normalizeProblemSource)
  }

  function updateType(nextType) {
    updateFilter('type', nextType, normalizeProblemType)
  }

  function collapseFiltersToSingle() {
    const query = { ...route.query }
    const filterValues = {
      level: levels.value,
      source: sources.value,
      type: questionTypes.value,
      year: years.value,
    }

    Object.entries(filterValues).forEach(([queryKey, values]) => {
      if (values[0]) {
        query[queryKey] = values[0]
      } else {
        delete query[queryKey]
      }
    })

    delete query.page
    router.push({ name: 'problems', query })
  }

  function clearFilters() {
    const query = { ...route.query }

    delete query.keyword
    delete query.level
    delete query.source
    delete query.type
    delete query.year
    delete query.page
    router.push({ name: 'problems', query })
  }

  return {
    keyword,
    level,
    levels,
    questionType,
    questionTypes,
    source,
    sources,
    sort,
    year,
    years,
    clearFilters,
    collapseFiltersToSingle,
    updateKeyword,
    updateLevel,
    updateSource,
    updateSort,
    updateType,
    updateYear,
  }
}
