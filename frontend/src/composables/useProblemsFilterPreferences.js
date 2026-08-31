import { ref } from 'vue'
import {
  DEFAULT_PROBLEMS_PINNED_FILTERS,
  PROBLEMS_SOURCE_CATALOG_OPTIONS,
  PROBLEMS_TYPE_CATALOG_OPTIONS,
  PROBLEMS_YEAR_CATALOG_OPTIONS,
} from '../config/problems.js'

export const PROBLEMS_PINNED_FILTERS_STORAGE_KEY = 'problem-bank-filter-pinned-v2'
export const PROBLEMS_FILTER_MODE_STORAGE_KEY = 'problem-bank-filter-mode-v2'
export const DEFAULT_PROBLEMS_FILTER_MODE = 'single'

const FILTER_FIELDS = ['year', 'source', 'type']
const FILTER_CATALOGS = {
  year: PROBLEMS_YEAR_CATALOG_OPTIONS,
  source: PROBLEMS_SOURCE_CATALOG_OPTIONS,
  type: PROBLEMS_TYPE_CATALOG_OPTIONS,
}

export function normalizeProblemsFilterMode(value) {
  return value === 'multiple' ? 'multiple' : DEFAULT_PROBLEMS_FILTER_MODE
}

export function normalizeProblemsPinnedFilters(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return Object.fromEntries(
    FILTER_FIELDS.map((field) => {
      const candidateValues = Array.isArray(savedValue[field])
        ? savedValue[field]
        : DEFAULT_PROBLEMS_PINNED_FILTERS[field]
      const validValues = new Set(
        FILTER_CATALOGS[field].map((option) => option.value).filter(Boolean),
      )
      const normalizedValues = [
        ...new Set(candidateValues.filter((candidate) => validValues.has(candidate))),
      ]

      return [field, normalizedValues]
    }),
  )
}

function readPinnedFilters() {
  if (typeof window === 'undefined') {
    return normalizeProblemsPinnedFilters({})
  }

  try {
    const savedValue = JSON.parse(window.localStorage.getItem(PROBLEMS_PINNED_FILTERS_STORAGE_KEY))
    return normalizeProblemsPinnedFilters(savedValue)
  } catch {
    return normalizeProblemsPinnedFilters({})
  }
}

function readFilterMode() {
  if (typeof window === 'undefined') {
    return DEFAULT_PROBLEMS_FILTER_MODE
  }

  try {
    return normalizeProblemsFilterMode(
      window.localStorage.getItem(PROBLEMS_FILTER_MODE_STORAGE_KEY),
    )
  } catch {
    return DEFAULT_PROBLEMS_FILTER_MODE
  }
}

function savePinnedFilters(value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(PROBLEMS_PINNED_FILTERS_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 本地存储不可用时，当前页面内的偏好状态仍然可以正常使用。
  }
}

function saveFilterMode(value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(PROBLEMS_FILTER_MODE_STORAGE_KEY, value)
  } catch {
    // 本地存储不可用时，当前页面内的筛选模式仍然可以正常使用。
  }
}

export function useProblemsFilterPreferences() {
  const filterMode = ref(readFilterMode())
  const pinnedFilters = ref(readPinnedFilters())

  function setFilterMode(value) {
    filterMode.value = normalizeProblemsFilterMode(value)
    saveFilterMode(filterMode.value)
  }

  function isFilterPinned(field, value) {
    return pinnedFilters.value[field]?.includes(value) ?? false
  }

  function setFilterPinned(field, value, shouldPin) {
    if (!FILTER_FIELDS.includes(field)) {
      return
    }

    const nextValues = new Set(pinnedFilters.value[field])

    if (shouldPin) {
      nextValues.add(value)
    } else {
      nextValues.delete(value)
    }

    pinnedFilters.value = normalizeProblemsPinnedFilters({
      ...pinnedFilters.value,
      [field]: [...nextValues],
    })
    savePinnedFilters(pinnedFilters.value)
  }

  return {
    filterMode,
    pinnedFilters,
    isFilterPinned,
    setFilterMode,
    setFilterPinned,
  }
}
