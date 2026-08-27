import { defineStore } from 'pinia'
import { normalizeProblemIds } from '../composables/useProblemsSelection.js'
import {
  createPracticeListRecord,
  normalizePracticeListsState,
  readPracticeListsState,
  writePracticeListsState,
} from '../composables/usePracticeListsStorage.js'

function getCurrentTimestamp() {
  return new Date().toISOString()
}

function findPracticeList(lists, listId) {
  const normalizedListId = String(listId ?? '').trim()
  return lists.find((list) => list.id === normalizedListId) ?? null
}

export const usePracticeListsStore = defineStore('practiceLists', {
  state: () => readPracticeListsState(),

  getters: {
    getPracticeListById: (state) => (listId) => findPracticeList(state.lists, listId),
    getPracticeListsForProblem: (state) => (problemId) => {
      const normalizedProblemId = String(problemId ?? '').trim()

      if (!normalizedProblemId) {
        return []
      }

      return state.lists.filter((list) =>
        list.items.some((item) => item.problemId === normalizedProblemId),
      )
    },
    isProblemInAnyPracticeList() {
      return (problemId) => this.getPracticeListsForProblem(problemId).length > 0
    },
  },

  actions: {
    persist() {
      return writePracticeListsState({
        schemaVersion: this.schemaVersion,
        defaultListId: this.defaultListId,
        lists: this.lists,
      })
    },

    replaceState(value, { persist = false } = {}) {
      const normalizedState = normalizePracticeListsState(value)
      this.schemaVersion = normalizedState.schemaVersion
      this.defaultListId = normalizedState.defaultListId
      this.lists = normalizedState.lists

      if (persist) {
        this.persist()
      }
    },

    createPracticeList({ description = '', title = '新建题单' } = {}) {
      const practiceList = createPracticeListRecord({ description, title })
      this.lists.push(practiceList)

      if (!this.defaultListId) {
        this.defaultListId = practiceList.id
      }

      this.persist()
      return practiceList
    },

    updatePracticeList(listId, changes = {}) {
      const practiceList = findPracticeList(this.lists, listId)
      const normalizedChanges =
        changes && typeof changes === 'object' && !Array.isArray(changes) ? changes : {}

      if (!practiceList) {
        return false
      }

      if (Object.hasOwn(normalizedChanges, 'title')) {
        const title = String(normalizedChanges.title ?? '').trim()

        if (!title) {
          return false
        }

        practiceList.title = title
      }

      if (Object.hasOwn(normalizedChanges, 'description')) {
        practiceList.description = String(normalizedChanges.description ?? '').trim()
      }

      practiceList.updatedAt = getCurrentTimestamp()
      this.persist()
      return true
    },

    deletePracticeList(listId) {
      const normalizedListId = String(listId ?? '').trim()
      const nextLists = this.lists.filter((list) => list.id !== normalizedListId)

      if (nextLists.length === this.lists.length) {
        return false
      }

      this.lists = nextLists

      if (this.defaultListId === normalizedListId) {
        this.defaultListId = this.lists[0]?.id ?? null
      }

      this.persist()
      return true
    },

    setDefaultPracticeList(listId) {
      const practiceList = findPracticeList(this.lists, listId)

      if (!practiceList) {
        return false
      }

      this.defaultListId = practiceList.id
      this.persist()
      return true
    },

    addProblemsToPracticeList(listId, problemIds) {
      const practiceList = findPracticeList(this.lists, listId)

      if (!practiceList) {
        return []
      }

      const currentProblemIds = new Set(practiceList.items.map((item) => item.problemId))
      const requestedProblemIds = Array.isArray(problemIds) ? problemIds : [problemIds]
      const newlyAddedProblemIds = normalizeProblemIds(requestedProblemIds).filter(
        (problemId) => !currentProblemIds.has(problemId),
      )

      if (newlyAddedProblemIds.length === 0) {
        return []
      }

      const timestamp = getCurrentTimestamp()
      practiceList.items.push(
        ...newlyAddedProblemIds.map((problemId) => ({
          problemId,
          note: '',
          addedAt: timestamp,
        })),
      )
      practiceList.updatedAt = timestamp
      this.persist()

      return newlyAddedProblemIds
    },

    removeProblemFromPracticeList(listId, problemId) {
      const practiceList = findPracticeList(this.lists, listId)
      const normalizedProblemId = String(problemId ?? '').trim()

      if (!practiceList || !normalizedProblemId) {
        return false
      }

      const nextItems = practiceList.items.filter((item) => item.problemId !== normalizedProblemId)

      if (nextItems.length === practiceList.items.length) {
        return false
      }

      practiceList.items = nextItems
      practiceList.updatedAt = getCurrentTimestamp()
      this.persist()
      return true
    },

    updateProblemNote(listId, problemId, note) {
      const practiceList = findPracticeList(this.lists, listId)
      const normalizedProblemId = String(problemId ?? '').trim()
      const item = practiceList?.items.find(
        (currentItem) => currentItem.problemId === normalizedProblemId,
      )

      if (!practiceList || !item) {
        return false
      }

      item.note = String(note ?? '').trim()
      practiceList.updatedAt = getCurrentTimestamp()
      return this.persist()
    },

    moveProblemInPracticeList(listId, problemId, targetIndex) {
      const practiceList = findPracticeList(this.lists, listId)
      const normalizedProblemId = String(problemId ?? '').trim()
      const currentIndex =
        practiceList?.items.findIndex((item) => item.problemId === normalizedProblemId) ?? -1

      if (!practiceList || currentIndex < 0 || practiceList.items.length < 2) {
        return false
      }

      const normalizedTargetIndex = Math.max(
        0,
        Math.min(Number(targetIndex), practiceList.items.length - 1),
      )

      if (!Number.isInteger(normalizedTargetIndex) || normalizedTargetIndex === currentIndex) {
        return false
      }

      const [item] = practiceList.items.splice(currentIndex, 1)
      practiceList.items.splice(normalizedTargetIndex, 0, item)
      practiceList.updatedAt = getCurrentTimestamp()
      this.persist()
      return true
    },
  },
})
