import { ref } from 'vue'

export const PRACTICE_LIST_OUTPUT_PREFERENCES_STORAGE_KEY = 'practice-list-output-preferences'

export function normalizePracticeListOutputPreferences(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return {
    includeNotes: typeof savedValue.includeNotes === 'boolean' ? savedValue.includeNotes : true,
    includePrintHeader:
      typeof savedValue.includePrintHeader === 'boolean' ? savedValue.includePrintHeader : false,
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
  const includePrintHeader = ref(preferences.includePrintHeader)

  function persistPreferences() {
    writeOutputPreferences({
      includeNotes: includeNotes.value,
      includePrintHeader: includePrintHeader.value,
    })
  }

  function setIncludeNotes(value) {
    includeNotes.value = Boolean(value)
    persistPreferences()
  }

  function setIncludePrintHeader(value) {
    includePrintHeader.value = Boolean(value)
    persistPreferences()
  }

  return {
    includeNotes,
    includePrintHeader,
    setIncludeNotes,
    setIncludePrintHeader,
  }
}
