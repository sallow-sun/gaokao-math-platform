import { ref } from 'vue'

export const PROBLEMS_ACTION_CONFIRMATIONS_STORAGE_KEY =
  'problem-bank-action-confirmation-preferences'

export const DEFAULT_PROBLEMS_ACTION_CONFIRMATIONS = Object.freeze({
  markCompleted: false,
  unmarkCompleted: true,
  addFavorite: false,
  removeFavorite: true,
})

export const PROBLEMS_ACTION_CONFIRMATION_OPTIONS = [
  {
    value: 'markCompleted',
    label: '标记已做时确认',
    description: '从未做改为已做前询问',
  },
  {
    value: 'unmarkCompleted',
    label: '取消已做时确认',
    description: '从已做恢复为未做前询问',
  },
  {
    value: 'addFavorite',
    label: '加入收藏时确认',
    description: '收藏题目前询问',
  },
  {
    value: 'removeFavorite',
    label: '移出收藏时确认',
    description: '移出收藏前询问',
  },
]

const ACTION_CONFIRMATION_NAMES = Object.keys(DEFAULT_PROBLEMS_ACTION_CONFIRMATIONS)

export function normalizeProblemsActionConfirmations(value) {
  const savedValue = value && typeof value === 'object' ? value : {}

  return Object.fromEntries(
    ACTION_CONFIRMATION_NAMES.map((name) => [
      name,
      typeof savedValue[name] === 'boolean'
        ? savedValue[name]
        : DEFAULT_PROBLEMS_ACTION_CONFIRMATIONS[name],
    ]),
  )
}

function readActionConfirmations() {
  if (typeof window === 'undefined') {
    return normalizeProblemsActionConfirmations({})
  }

  try {
    return normalizeProblemsActionConfirmations(
      JSON.parse(window.localStorage.getItem(PROBLEMS_ACTION_CONFIRMATIONS_STORAGE_KEY)),
    )
  } catch {
    return normalizeProblemsActionConfirmations({})
  }
}

function writeActionConfirmations(actionConfirmations) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      PROBLEMS_ACTION_CONFIRMATIONS_STORAGE_KEY,
      JSON.stringify(actionConfirmations),
    )
  } catch {
    // 本地存储不可用时，本页内的二次确认偏好仍然可以正常使用。
  }
}

export function useProblemsActionPreferences() {
  const actionConfirmations = ref(readActionConfirmations())

  function setActionConfirmation(name, enabled) {
    if (!ACTION_CONFIRMATION_NAMES.includes(name)) {
      return
    }

    actionConfirmations.value = {
      ...actionConfirmations.value,
      [name]: Boolean(enabled),
    }
    writeActionConfirmations(actionConfirmations.value)
  }

  return {
    actionConfirmations,
    setActionConfirmation,
  }
}
