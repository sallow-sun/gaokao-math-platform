import { ref } from 'vue'
import {
  PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS,
  useProblemPrintPreferences,
} from './useProblemPrintPreferences.js'

export const PRACTICE_LIST_OUTPUT_PREFERENCES_STORAGE_KEY = 'practice-list-output-preferences'
export const PRACTICE_LIST_PRINT_PAGE_LAYOUTS = PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS

export function normalizePracticeListOutputPreferences(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return {
    includeNotes: typeof savedValue.includeNotes === 'boolean' ? savedValue.includeNotes : true,
    includePrintHeader:
      typeof savedValue.includePrintHeader === 'boolean' ? savedValue.includePrintHeader : false,
    printPageLayout: PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS.some(
      (option) => option.value === savedValue.printPageLayout,
    )
      ? savedValue.printPageLayout
      : 'auto',
  }
}

function readOutputPreferences() {
  if (typeof window === 'undefined') {
    return normalizePracticeListOutputPreferences(null)
  }

  try {
    return normalizePracticeListOutputPreferences(
      JSON.parse(window.localStorage.getItem(PRACTICE_LIST_OUTPUT_PREFERENCES_STORAGE_KEY)),
    )
  } catch {
    return normalizePracticeListOutputPreferences(null)
  }
}

function writeOutputPreferences(value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(PRACTICE_LIST_OUTPUT_PREFERENCES_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 本地存储不可用时，本次页面内的输出设置仍然有效。
  }
}

export function usePracticeListOutputPreferences() {
  const preferences = readOutputPreferences()
  const includeNotes = ref(preferences.includeNotes)
  const { includePrintHeader, printPageLayout, setIncludePrintHeader, setPrintPageLayout } =
    useProblemPrintPreferences()

  function persistPreferences() {
    writeOutputPreferences({
      includeNotes: includeNotes.value,
      includePrintHeader: includePrintHeader.value,
      printPageLayout: printPageLayout.value,
    })
  }

  function setIncludeNotes(value) {
    includeNotes.value = Boolean(value)
    persistPreferences()
  }

  return {
    includeNotes,
    includePrintHeader,
    printPageLayout,
    setIncludeNotes,
    setIncludePrintHeader,
    setPrintPageLayout,
  }
}
