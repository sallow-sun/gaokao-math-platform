import { ref } from 'vue'
import { PROBLEMS_PRINT_OPTION_OPTIONS } from '../config/problems.js'

export const PROBLEM_PRINT_PREFERENCES_STORAGE_KEY = 'problem-print-preferences-v2'
export const LEGACY_PROBLEMS_PRINT_OPTIONS_STORAGE_KEY = 'problem-bank-print-options'
export const LEGACY_PRACTICE_LIST_OUTPUT_STORAGE_KEY = 'practice-list-output-preferences'
export const LEGACY_QUESTION_PREFERENCES_STORAGE_KEY = 'question-page-preferences'

export const PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS = Object.freeze([
  { value: 'auto', label: '自动排版' },
  { value: 'one-per-page', label: '一页一题' },
  { value: 'two-per-page', label: '一页两题' },
])

const PRINT_OPTION_NAMES = PROBLEMS_PRINT_OPTION_OPTIONS.map((option) => option.value)
const PRINT_PAGE_LAYOUT_VALUES = PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS.map((option) => option.value)
const DEFAULT_PRINT_OPTIONS = Object.fromEntries(
  PRINT_OPTION_NAMES.map((name) => [name, name === 'type' || name === 'content']),
)

export function normalizeProblemPrintContent(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .filter((line) => line.trim())
    .join('\n')
    .trimEnd()
}

export function normalizeProblemPrintOptions(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return Object.fromEntries(
    PRINT_OPTION_NAMES.map((name) => [
      name,
      typeof savedValue[name] === 'boolean' ? savedValue[name] : DEFAULT_PRINT_OPTIONS[name],
    ]),
  )
}

function readStoredJson(storageKey) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

function readPreferences() {
  const savedPreferences = readStoredJson(PROBLEM_PRINT_PREFERENCES_STORAGE_KEY)
  const legacyPrintOptions = readStoredJson(LEGACY_PROBLEMS_PRINT_OPTIONS_STORAGE_KEY)
  const legacyPracticeListOutput = readStoredJson(LEGACY_PRACTICE_LIST_OUTPUT_STORAGE_KEY)
  const legacyQuestionPreferences = readStoredJson(LEGACY_QUESTION_PREFERENCES_STORAGE_KEY)

  return {
    includeHeader:
      typeof savedPreferences?.includeHeader === 'boolean'
        ? savedPreferences.includeHeader
        : Boolean(legacyPracticeListOutput?.includePrintHeader),
    options: normalizeProblemPrintOptions(
      savedPreferences?.options ?? legacyPrintOptions ?? legacyQuestionPreferences?.printOptions,
    ),
    pageLayout: PRINT_PAGE_LAYOUT_VALUES.includes(savedPreferences?.pageLayout)
      ? savedPreferences.pageLayout
      : PRINT_PAGE_LAYOUT_VALUES.includes(legacyPracticeListOutput?.printPageLayout)
        ? legacyPracticeListOutput.printPageLayout
        : 'auto',
  }
}

const initialPreferences = readPreferences()
const includePrintHeader = ref(initialPreferences.includeHeader)
const printOptions = ref(initialPreferences.options)
const printPageLayout = ref(initialPreferences.pageLayout)

function writePreferences() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      PROBLEM_PRINT_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        includeHeader: includePrintHeader.value,
        options: printOptions.value,
        pageLayout: printPageLayout.value,
      }),
    )
  } catch {
    // 本地存储不可用时，偏好仍在当前页面会话内有效。
  }
}

export function createProblemPrintPreset(preset) {
  if (preset === 'practice-paper') {
    return { ...DEFAULT_PRINT_OPTIONS }
  }

  return Object.fromEntries(PRINT_OPTION_NAMES.map((name) => [name, true]))
}

export function useProblemPrintPreferences() {
  function setIncludePrintHeader(value) {
    includePrintHeader.value = Boolean(value)
    writePreferences()
  }

  function setPrintOption(name, visible) {
    if (!PRINT_OPTION_NAMES.includes(name)) {
      return
    }

    printOptions.value = {
      ...printOptions.value,
      [name]: Boolean(visible),
    }
    writePreferences()
  }

  function setPrintPageLayout(value) {
    if (!PRINT_PAGE_LAYOUT_VALUES.includes(value)) {
      return
    }

    printPageLayout.value = value
    writePreferences()
  }

  function setPrintPreset(preset) {
    printOptions.value = createProblemPrintPreset(preset)
    writePreferences()
  }

  return {
    includePrintHeader,
    printOptions,
    printPageLayout,
    setIncludePrintHeader,
    setPrintOption,
    setPrintPageLayout,
    setPrintPreset,
  }
}
