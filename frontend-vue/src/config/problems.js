export const DEFAULT_PROBLEMS_SORT = 'newest'

export const PROBLEMS_DISPLAY_OPTION_OPTIONS = [
  { value: 'selection', label: '选择框' },
  { value: 'problem-id', label: '题号' },
  { value: 'tags', label: '知识标签' },
  { value: 'value', label: '训练价值' },
  { value: 'source', label: '来源信息' },
  { value: 'export', label: '导出按钮' },
]

export const PROBLEMS_PRINT_OPTION_OPTIONS = [
  { value: 'problem-id', label: '题号' },
  { value: 'type', label: '题型' },
  { value: 'content', label: '题干' },
  { value: 'title', label: '题目标题' },
  { value: 'tags', label: '知识标签' },
  { value: 'value', label: '训练价值' },
  { value: 'source', label: '来源信息' },
]

// 临时使用 frontend/problems 原型中的两道题，后续由新版题库接口替换。
export const PROBLEMS_PROTOTYPE_ITEMS = [
  {
    id: 'P10001',
    completed: false,
    year: '2025',
    source: 'national-new-1',
    sourceLabel: '新高考Ⅰ卷',
    type: 'single-choice',
    typeLabel: '单选题',
    level: 'red',
    title: '2025 年新高考Ⅰ卷 · T1',
    detail: '复数的基本运算',
    tags: ['复数'],
    sourceText: '2025 · 新高考Ⅰ卷 · T1',
    content: '1. (1 + 5i)i 的虚部为（    ）\n\nA. −1        B. 0        C. 1        D. 6',
  },
  {
    id: 'P10002',
    completed: true,
    year: '2024',
    source: 'national-a',
    sourceLabel: '全国甲卷',
    type: 'solution',
    typeLabel: '解答题',
    level: 'green',
    title: '2024 年全国甲卷 · T21',
    detail: '函数的单调性与最值',
    tags: ['函数', '导数'],
    sourceText: '2024 · 全国甲卷 · T21',
    content:
      '21. 已知函数 f(x) = x³ − 3x² + a。\n\n(1) 求 f(x) 的单调区间；\n(2) 讨论 f(x) 的极值。',
  },
]

export const PROBLEMS_SORT_OPTIONS = [
  { value: 'newest', label: '最新收录' },
  { value: 'oldest', label: '最早收录' },
  { value: 'easy-first', label: '由易到难' },
  { value: 'hard-first', label: '由难到易' },
  { value: 'view-most', label: '最多浏览' },
  { value: 'star-most', label: '最多收藏' },
]

export const PROBLEMS_LEVEL_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'red', label: 'RED' },
  { value: 'orange', label: 'ORANGE' },
  { value: 'yellow', label: 'YELLOW' },
  { value: 'green', label: 'GREEN' },
  { value: 'cyan', label: 'CYAN' },
  { value: 'blue', label: 'BLUE' },
  { value: 'purple', label: 'PURPLE' },
  { value: 'black', label: 'BLACK' },
  { value: 'white', label: 'WHITE' },
]

export const PROBLEMS_YEAR_OPTIONS = [
  { value: '', label: '全部' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
]

export const PROBLEMS_YEAR_CATALOG_OPTIONS = [
  { value: '', label: '全部' },
  ...Array.from({ length: 2026 - 1978 + 1 }, (_, index) => {
    const year = String(2026 - index)
    return { value: year, label: year }
  }),
]

export const PROBLEMS_SOURCE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'national-new-1', label: '新高考Ⅰ卷' },
  { value: 'national-new-2', label: '新高考Ⅱ卷' },
  { value: 'local', label: '地方卷' },
  { value: 'mock', label: '模拟题' },
]

export const PROBLEMS_SOURCE_CATALOG_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'national-new-1', label: '新高考Ⅰ卷' },
  { value: 'national-new-2', label: '新高考Ⅱ卷' },
  { value: 'national-a', label: '全国甲卷' },
  { value: 'local', label: '地方卷' },
  { value: 'mock', label: '模拟题' },
]

export const PROBLEMS_TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'single-choice', label: '单选题' },
  { value: 'multiple-choice', label: '多选题' },
  { value: 'fill-blank', label: '填空题' },
  { value: 'solution', label: '解答题' },
]

export const PROBLEMS_TYPE_CATALOG_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'single-choice', label: '单项选择题' },
  { value: 'multiple-choice', label: '多项选择题' },
  { value: 'fill-blank', label: '填空题' },
  { value: 'solution', label: '解答题' },
]

export const DEFAULT_PROBLEMS_PINNED_FILTERS = {
  year: PROBLEMS_YEAR_OPTIONS.slice(1).map((option) => option.value),
  source: PROBLEMS_SOURCE_OPTIONS.slice(1).map((option) => option.value),
  type: PROBLEMS_TYPE_OPTIONS.slice(1).map((option) => option.value),
}

export function normalizeProblemSort(value) {
  const isSupported = PROBLEMS_SORT_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : DEFAULT_PROBLEMS_SORT
}

export function normalizeProblemLevel(value) {
  const isSupported = PROBLEMS_LEVEL_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : ''
}

export function normalizeProblemYear(value) {
  const isSupported = PROBLEMS_YEAR_CATALOG_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : ''
}

export function normalizeProblemSource(value) {
  const isSupported = PROBLEMS_SOURCE_CATALOG_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : ''
}

export function normalizeProblemType(value) {
  const isSupported = PROBLEMS_TYPE_CATALOG_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : ''
}
