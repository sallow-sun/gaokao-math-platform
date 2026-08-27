import { normalizeProblemIds } from './useProblemsSelection.js'

export const PRACTICE_LISTS_SCHEMA_VERSION = 1
export const PRACTICE_LISTS_STORAGE_KEY = 'mathverse-practice-lists'
export const LEGACY_PRACTICE_LIST_STORAGE_KEY = 'problem-bank-practice-list'
export const LEGACY_DEFAULT_PRACTICE_LIST_ID = 'local-default'

function getCurrentTimestamp() {
  return new Date().toISOString()
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTimestamp(value, fallback) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return fallback
  }

  return value
}

export function createPracticeListId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyPracticeListsState() {
  return {
    schemaVersion: PRACTICE_LISTS_SCHEMA_VERSION,
    defaultListId: null,
    lists: [],
  }
}

export function createPracticeListRecord(
  { description = '', id = createPracticeListId(), items = [], title = '新建题单' } = {},
  timestamp = getCurrentTimestamp(),
) {
  return normalizePracticeListRecord(
    {
      id,
      title,
      description,
      createdAt: timestamp,
      updatedAt: timestamp,
      items,
    },
    timestamp,
  )
}

export function normalizePracticeListItems(value, fallbackTimestamp = getCurrentTimestamp()) {
  if (!Array.isArray(value)) {
    return []
  }

  const normalizedItems = []
  const seenProblemIds = new Set()

  value.forEach((item) => {
    const rawProblemId = typeof item === 'object' && item !== null ? item.problemId : item
    const [problemId] = normalizeProblemIds([rawProblemId])

    if (!problemId || seenProblemIds.has(problemId)) {
      return
    }

    seenProblemIds.add(problemId)
    normalizedItems.push({
      problemId,
      note: typeof item === 'object' && item !== null ? normalizeText(item.note) : '',
      addedAt:
        typeof item === 'object' && item !== null
          ? normalizeTimestamp(item.addedAt, fallbackTimestamp)
          : fallbackTimestamp,
    })
  })

  return normalizedItems
}

export function normalizePracticeListRecord(value, fallbackTimestamp = getCurrentTimestamp()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const id = normalizeText(value.id) || createPracticeListId()
  const createdAt = normalizeTimestamp(value.createdAt, fallbackTimestamp)

  return {
    id,
    title: normalizeText(value.title) || '未命名题单',
    description: normalizeText(value.description),
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
    items: normalizePracticeListItems(value.items, createdAt),
  }
}

export function normalizePracticeListsState(value, fallbackTimestamp = getCurrentTimestamp()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyPracticeListsState()
  }

  const lists = []
  const seenListIds = new Set()

  if (Array.isArray(value.lists)) {
    value.lists.forEach((list) => {
      const normalizedList = normalizePracticeListRecord(list, fallbackTimestamp)

      if (!normalizedList || seenListIds.has(normalizedList.id)) {
        return
      }

      seenListIds.add(normalizedList.id)
      lists.push(normalizedList)
    })
  }

  const requestedDefaultListId = normalizeText(value.defaultListId)
  const defaultListId = seenListIds.has(requestedDefaultListId)
    ? requestedDefaultListId
    : (lists[0]?.id ?? null)

  return {
    schemaVersion: PRACTICE_LISTS_SCHEMA_VERSION,
    defaultListId,
    lists,
  }
}

export function migrateLegacyPracticeList(value, timestamp = getCurrentTimestamp()) {
  const problemIds = Array.isArray(value) ? normalizeProblemIds(value) : []

  if (problemIds.length === 0) {
    return createEmptyPracticeListsState()
  }

  const defaultList = createPracticeListRecord(
    {
      id: LEGACY_DEFAULT_PRACTICE_LIST_ID,
      title: '默认题单',
      description: '由旧版本地题单自动迁移',
      items: problemIds,
    },
    timestamp,
  )

  return {
    schemaVersion: PRACTICE_LISTS_SCHEMA_VERSION,
    defaultListId: defaultList.id,
    lists: [defaultList],
  }
}

function readStoredJson(storage, key) {
  const storedValue = storage.getItem(key)

  if (storedValue === null) {
    return { found: false, value: null }
  }

  try {
    return { found: true, value: JSON.parse(storedValue) }
  } catch {
    return { found: true, value: null }
  }
}

export function writePracticeListsState(state, storage) {
  const targetStorage = storage === undefined ? getBrowserStorage() : storage

  if (!targetStorage) {
    return false
  }

  try {
    const normalizedState = normalizePracticeListsState(state)
    targetStorage.setItem(PRACTICE_LISTS_STORAGE_KEY, JSON.stringify(normalizedState))
    return true
  } catch {
    return false
  }
}

export function readPracticeListsState(storage) {
  const targetStorage = storage === undefined ? getBrowserStorage() : storage

  if (!targetStorage) {
    return createEmptyPracticeListsState()
  }

  try {
    const currentState = readStoredJson(targetStorage, PRACTICE_LISTS_STORAGE_KEY)

    if (currentState.found && currentState.value) {
      return normalizePracticeListsState(currentState.value)
    }

    const legacyState = readStoredJson(targetStorage, LEGACY_PRACTICE_LIST_STORAGE_KEY)
    const migratedState = migrateLegacyPracticeList(legacyState.value)

    if (migratedState.lists.length > 0) {
      writePracticeListsState(migratedState, targetStorage)
    }

    return migratedState
  } catch {
    return createEmptyPracticeListsState()
  }
}
