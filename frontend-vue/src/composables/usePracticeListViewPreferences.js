import { ref } from 'vue'

export const PRACTICE_LIST_VIEW_STORAGE_KEY = 'practice-list-active-view'
export const DEFAULT_PRACTICE_LIST_VIEW_MODE = 'list-view'

export function normalizePracticeListViewMode(value) {
  return value === 'preview-view' ? 'preview-view' : DEFAULT_PRACTICE_LIST_VIEW_MODE
}

function readPracticeListViewMode() {
  if (typeof window === 'undefined') {
    return DEFAULT_PRACTICE_LIST_VIEW_MODE
  }

  try {
    return normalizePracticeListViewMode(
      window.localStorage.getItem(PRACTICE_LIST_VIEW_STORAGE_KEY),
    )
  } catch {
    return DEFAULT_PRACTICE_LIST_VIEW_MODE
  }
}

export function usePracticeListViewPreferences() {
  const viewMode = ref(readPracticeListViewMode())

  function setViewMode(value) {
    viewMode.value = normalizePracticeListViewMode(value)

    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(PRACTICE_LIST_VIEW_STORAGE_KEY, viewMode.value)
    } catch {
      // 本地存储不可用时，本次页面内的浏览方式仍然有效。
    }
  }

  return {
    viewMode,
    setViewMode,
  }
}
