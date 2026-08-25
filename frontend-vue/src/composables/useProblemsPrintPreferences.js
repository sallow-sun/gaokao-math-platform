import { ref } from 'vue'
import { PROBLEMS_PRINT_OPTION_OPTIONS } from '../config/problems.js'

export const PROBLEMS_PRINT_OPTIONS_STORAGE_KEY = 'problem-bank-print-options'

const PRINT_OPTION_NAMES = PROBLEMS_PRINT_OPTION_OPTIONS.map((option) => option.value)
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

export function normalizeProblemsPrintOptions(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return Object.fromEntries(
    PRINT_OPTION_NAMES.map((name) => [
      name,
      typeof savedValue[name] === 'boolean' ? savedValue[name] : DEFAULT_PRINT_OPTIONS[name],
    ]),
  )
}

function readPrintOptions() {
  if (typeof window === 'undefined') {
    return normalizeProblemsPrintOptions({})
  }

  try {
    return normalizeProblemsPrintOptions(
      JSON.parse(window.localStorage.getItem(PROBLEMS_PRINT_OPTIONS_STORAGE_KEY)),
    )
  } catch {
    return normalizeProblemsPrintOptions({})
  }
}

function writePrintOptions(printOptions) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(PROBLEMS_PRINT_OPTIONS_STORAGE_KEY, JSON.stringify(printOptions))
  } catch {
    // 本地存储不可用时，本页内的打印设置仍然可以正常使用。
  }
}

export function createProblemsPrintPreset(preset) {
  if (preset === 'practice-paper') {
    return { ...DEFAULT_PRINT_OPTIONS }
  }

  return Object.fromEntries(PRINT_OPTION_NAMES.map((name) => [name, true]))
}

export function useProblemsPrintPreferences() {
  const printOptions = ref(readPrintOptions())

  function setPrintOption(name, visible) {
    if (!PRINT_OPTION_NAMES.includes(name)) {
      return
    }

    printOptions.value = {
      ...printOptions.value,
      [name]: Boolean(visible),
    }
    writePrintOptions(printOptions.value)
  }

  function setPrintPreset(preset) {
    printOptions.value = createProblemsPrintPreset(preset)
    writePrintOptions(printOptions.value)
  }

  return {
    printOptions,
    setPrintOption,
    setPrintPreset,
  }
}
