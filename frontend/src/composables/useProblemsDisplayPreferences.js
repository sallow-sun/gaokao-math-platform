import { ref } from 'vue'
import { PROBLEMS_DISPLAY_OPTION_OPTIONS } from '../config/problems.js'

export const PROBLEMS_ACTIVE_VIEW_STORAGE_KEY = 'problem-bank-active-view'
export const PROBLEMS_DISPLAY_OPTIONS_STORAGE_KEY = 'problem-bank-display-options'
export const DEFAULT_PROBLEMS_VIEW_MODE = 'preview-view'

const DISPLAY_OPTION_NAMES = PROBLEMS_DISPLAY_OPTION_OPTIONS.map((option) => option.value)

export function normalizeProblemsViewMode(value) {
  return value === 'list-view' ? 'list-view' : DEFAULT_PROBLEMS_VIEW_MODE
}

export function normalizeProblemsDisplayOptions(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return Object.fromEntries(
    DISPLAY_OPTION_NAMES.map((name) => [
      name,
      typeof savedValue[name] === 'boolean' ? savedValue[name] : true,
    ]),
  )
}

function readViewMode() {
  if (typeof window === 'undefined') {
    return DEFAULT_PROBLEMS_VIEW_MODE
  }

  try {
    return normalizeProblemsViewMode(window.localStorage.getItem(PROBLEMS_ACTIVE_VIEW_STORAGE_KEY))
  } catch {
    return DEFAULT_PROBLEMS_VIEW_MODE
  }
}

function readDisplayOptions() {
  if (typeof window === 'undefined') {
    return normalizeProblemsDisplayOptions({})
  }

  try {
    const savedValue = JSON.parse(window.localStorage.getItem(PROBLEMS_DISPLAY_OPTIONS_STORAGE_KEY))
    return normalizeProblemsDisplayOptions(savedValue)
  } catch {
    return normalizeProblemsDisplayOptions({})
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 本地存储不可用时，当前页面内的展示设置仍然可以正常使用。
  }
}

export function useProblemsDisplayPreferences() {
  const viewMode = ref(readViewMode())
  const displayOptions = ref(readDisplayOptions())

  function setViewMode(value) {
    viewMode.value = normalizeProblemsViewMode(value)
    writeStorage(PROBLEMS_ACTIVE_VIEW_STORAGE_KEY, viewMode.value)
  }

  function setDisplayOption(name, visible) {
    if (!DISPLAY_OPTION_NAMES.includes(name)) {
      return
    }

    displayOptions.value = {
      ...displayOptions.value,
      [name]: Boolean(visible),
    }
    writeStorage(PROBLEMS_DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(displayOptions.value))
  }

  function setAllDisplayOptions(visible) {
    displayOptions.value = Object.fromEntries(
      DISPLAY_OPTION_NAMES.map((name) => [name, Boolean(visible)]),
    )
    writeStorage(PROBLEMS_DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(displayOptions.value))
  }

  return {
    displayOptions,
    viewMode,
    setAllDisplayOptions,
    setDisplayOption,
    setViewMode,
  }
}
