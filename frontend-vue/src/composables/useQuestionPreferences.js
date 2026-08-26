import { ref } from 'vue'
import { PROBLEMS_PRINT_OPTION_OPTIONS } from '../config/problems.js'

export const QUESTION_PREFERENCES_STORAGE_KEY = 'question-page-preferences'

export const QUESTION_ANSWER_PLACEMENT_OPTIONS = [
  { value: 'sidebar', label: '右侧栏（默认）' },
  { value: 'main', label: '草稿区下方' },
]

export const QUESTION_TYPE_COLOR_OPTIONS = [
  { value: 'by-type', label: '按题型着色' },
  { value: 'uniform', label: '统一黑色' },
]

export const QUESTION_PRINT_OPTION_OPTIONS = [
  ...PROBLEMS_PRINT_OPTION_OPTIONS,
  { value: 'answer', label: '答案' },
  { value: 'solution', label: '解析' },
]

const PRINT_OPTION_NAMES = QUESTION_PRINT_OPTION_OPTIONS.map((option) => option.value)
const DEFAULT_PRINT_OPTIONS = Object.fromEntries(
  PRINT_OPTION_NAMES.map((name) => [name, name === 'type' || name === 'content']),
)

function normalizeChoice(value, options, fallback) {
  return options.some((option) => option.value === value) ? value : fallback
}

function normalizePrintOptions(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return Object.fromEntries(
    PRINT_OPTION_NAMES.map((name) => [
      name,
      typeof savedValue[name] === 'boolean' ? savedValue[name] : DEFAULT_PRINT_OPTIONS[name],
    ]),
  )
}

function normalizePreferences(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return {
    answerPlacement: normalizeChoice(
      savedValue.answerPlacement,
      QUESTION_ANSWER_PLACEMENT_OPTIONS,
      'sidebar',
    ),
    typeColorMode: normalizeChoice(
      savedValue.typeColorMode,
      QUESTION_TYPE_COLOR_OPTIONS,
      'by-type',
    ),
    printOptions: normalizePrintOptions(savedValue.printOptions),
  }
}

function readPreferences() {
  if (typeof window === 'undefined') {
    return normalizePreferences({})
  }

  try {
    return normalizePreferences(
      JSON.parse(window.localStorage.getItem(QUESTION_PREFERENCES_STORAGE_KEY)),
    )
  } catch {
    return normalizePreferences({})
  }
}

function writePreferences(preferences) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(QUESTION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // 本地存储不可用时，偏好在当前页面会话内仍然有效。
  }
}

export function createQuestionPrintPreset(preset) {
  if (preset === 'practice-paper') {
    return { ...DEFAULT_PRINT_OPTIONS }
  }

  return Object.fromEntries(PRINT_OPTION_NAMES.map((name) => [name, true]))
}

export function useQuestionPreferences() {
  const savedPreferences = readPreferences()
  const answerPlacement = ref(savedPreferences.answerPlacement)
  const typeColorMode = ref(savedPreferences.typeColorMode)
  const printOptions = ref(savedPreferences.printOptions)

  function persistPreferences() {
    writePreferences({
      answerPlacement: answerPlacement.value,
      typeColorMode: typeColorMode.value,
      printOptions: printOptions.value,
    })
  }

  function setAnswerPlacement(value) {
    answerPlacement.value = normalizeChoice(value, QUESTION_ANSWER_PLACEMENT_OPTIONS, 'sidebar')
    persistPreferences()
  }

  function setTypeColorMode(value) {
    typeColorMode.value = normalizeChoice(value, QUESTION_TYPE_COLOR_OPTIONS, 'by-type')
    persistPreferences()
  }

  function setPrintOption(name, visible) {
    if (!PRINT_OPTION_NAMES.includes(name)) {
      return
    }

    printOptions.value = {
      ...printOptions.value,
      [name]: Boolean(visible),
    }
    persistPreferences()
  }

  function setPrintPreset(preset) {
    printOptions.value = createQuestionPrintPreset(preset)
    persistPreferences()
  }

  return {
    answerPlacement,
    printOptions,
    setAnswerPlacement,
    setPrintOption,
    setPrintPreset,
    setTypeColorMode,
    typeColorMode,
  }
}
