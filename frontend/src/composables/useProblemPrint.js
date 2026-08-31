import { nextTick, readonly, ref } from 'vue'
import { PROBLEMS_PRINT_OPTION_OPTIONS } from '../config/problems.js'

export const PROBLEM_PRINT_BODY_CLASS = 'is-printing-problems'

const PRINT_OPTION_BODY_CLASSES = PROBLEMS_PRINT_OPTION_OPTIONS.map(
  (option) => `print-hide-${option.value}`,
)

const activePrintJob = ref(null)
const isPrinting = ref(false)
let titleBeforePrint = ''

function normalizeEntries(entries) {
  return entries
    .filter((entry) => entry?.problem)
    .map((entry, index) => ({
      ...entry,
      key: entry.key ?? entry.problem.id ?? index,
    }))
}

function clearPrintClasses() {
  if (typeof document === 'undefined') {
    return
  }

  document.body.classList.remove(PROBLEM_PRINT_BODY_CLASS, ...PRINT_OPTION_BODY_CLASSES)
}

export function finishProblemPrint() {
  clearPrintClasses()
  activePrintJob.value = null
  isPrinting.value = false

  if (typeof document !== 'undefined' && titleBeforePrint) {
    document.title = titleBeforePrint
    titleBeforePrint = ''
  }
}

export function useProblemPrint() {
  async function printProblems({
    documentTitle = '高考数学练习卷',
    entries = [],
    forPdf = false,
    header = null,
    includeHeader = false,
    options = {},
    pageLayout = 'auto',
  } = {}) {
    const printableEntries = normalizeEntries(entries)

    if (
      printableEntries.length === 0 ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return { ok: false, reason: 'empty' }
    }

    const hasProblemContent = Object.values(options).some(Boolean)
    const hasNotes = printableEntries.some((entry) => Boolean(entry.note))

    if (!hasProblemContent && !hasNotes) {
      return { ok: false, reason: 'no-content' }
    }

    finishProblemPrint()
    titleBeforePrint = document.title
    document.title = documentTitle
    activePrintJob.value = {
      entries: printableEntries,
      header,
      includeHeader: Boolean(includeHeader),
      options: { ...options },
      pageLayout: ['auto', 'one-per-page', 'two-per-page'].includes(pageLayout)
        ? pageLayout
        : 'auto',
    }
    isPrinting.value = true
    document.body.classList.add(PROBLEM_PRINT_BODY_CLASS)

    PROBLEMS_PRINT_OPTION_OPTIONS.forEach((option) => {
      if (!options[option.value]) {
        document.body.classList.add(`print-hide-${option.value}`)
      }
    })

    try {
      await nextTick()
      window.print()
      return { ok: true, forPdf }
    } catch {
      finishProblemPrint()
      return { ok: false, reason: 'print-unavailable' }
    }
  }

  return {
    activePrintJob: readonly(activePrintJob),
    finishPrint: finishProblemPrint,
    isPrinting: readonly(isPrinting),
    printProblems,
  }
}
