import { defineStore } from 'pinia'
import { authService } from '../services/authService.js'
import { practiceListService } from '../services/practiceListService.js'
import { normalizeProblemIds } from '../composables/useProblemsSelection.js'
import {
  createEmptyPracticeListsState,
  normalizePracticeListsState,
} from '../composables/usePracticeListsStorage.js'

function getCurrentTimestamp() {
  return new Date().toISOString()
}

function findPracticeList(lists, listId) {
  const normalizedListId = String(listId ?? '').trim()
  return lists.find((list) => list.id === normalizedListId) ?? null
}

export const usePracticeListsStore = defineStore('practiceLists', {
  state: () => ({
    ...createEmptyPracticeListsState(),
    authenticated: false,
    authUser: null,
    authRevision: 0,
    initialized: false,
    loading: false,
    syncError: '',
    publicLists: { official: [], square: [] },
    viewedLists: {},
  }),

  getters: {
    getPracticeListById: (state) => (listId) =>
      findPracticeList(state.lists, listId) ?? state.viewedLists[String(listId ?? '')] ?? null,
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
    async initialize({ force = false } = {}) {
      if (this.initialized && !force) return this.authenticated
      if (this.loading && !force) return this.authenticated

      const revision = ++this.authRevision
      const wasAuthenticated = this.authenticated
      this.loading = true
      this.syncError = ''

      try {
        const auth = await authService.me()
        if (revision !== this.authRevision) return this.authenticated

        this.authenticated = Boolean(auth?.authenticated)
        this.authUser = auth?.user ?? null

        if (this.authenticated) {
          const summaries = await practiceListService.listMine()
          const details = await Promise.all(
            summaries.map((summary) => practiceListService.detail(summary.id, true)),
          )
          this.lists = details
          this.defaultListId = details.find((list) => list.isDefault)?.id ?? null
        } else if (wasAuthenticated || this.lists.length) {
          this.replaceState(createEmptyPracticeListsState())
        }
      } catch (error) {
        if (revision === this.authRevision) {
          if (error?.status === 401) {
            this.authenticated = false
            this.authUser = null
            if (wasAuthenticated || this.lists.length) {
              this.replaceState(createEmptyPracticeListsState())
            }
          }
          this.syncError = error?.message || '题单数据同步失败'
        }
      } finally {
        if (revision === this.authRevision) {
          this.loading = false
          this.initialized = true
        }
      }

      return this.authenticated
    },

    async establishSession(auth) {
      ++this.authRevision
      this.loading = true
      this.syncError = ''
      this.authenticated = Boolean(auth?.authenticated)
      this.authUser = auth?.user ?? null

      try {
        if (this.authenticated) {
          const summaries = await practiceListService.listMine()
          const details = await Promise.all(
            summaries.map((summary) => practiceListService.detail(summary.id, true)),
          )
          this.lists = details
          this.defaultListId = details.find((list) => list.isDefault)?.id ?? null
        }
      } catch (error) {
        this.syncError = error?.message || '题单数据同步失败'
      } finally {
        this.loading = false
        this.initialized = true
      }

      return this.authenticated
    },

    clearSession() {
      ++this.authRevision
      this.authenticated = false
      this.authUser = null
      this.initialized = true
      this.loading = false
      this.syncError = ''
      this.viewedLists = {}
      this.replaceState(createEmptyPracticeListsState())
    },

    async logout() {
      try {
        await authService.logout()
      } catch (error) {
        // An expired session is already logged out from the server's perspective.
        if (error?.status !== 401) throw error
      }
      this.clearSession()
    },

    async loadPublicLists(kind) {
      const normalizedKind = kind === 'official' ? 'official' : 'square'
      const lists = await practiceListService.listPublic(normalizedKind)
      this.publicLists[normalizedKind] = lists
      return lists
    },

    async loadPracticeList(listId) {
      const existing = findPracticeList(this.lists, listId)
      if (
        existing &&
        (!this.authenticated ||
          existing.id.startsWith('local-') ||
          existing.items?.length ||
          existing.problemCount === 0)
      ) {
        return existing
      }

      const detail = await practiceListService.detail(listId, Boolean(existing?.canEdit))
      if (detail.canEdit) {
        const index = this.lists.findIndex((list) => list.id === detail.id)
        if (index >= 0) this.lists.splice(index, 1, detail)
        else this.lists.push(detail)
      } else {
        this.viewedLists[detail.id] = detail
      }
      return detail
    },

    persist() {
      return this.authenticated
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

    async createPracticeList({
      description = '',
      title = '新建题单',
      isPublic = true,
      isOfficial = false,
    } = {}) {
      if (!this.authenticated) {
        throw new Error('请先登录后再创建题单')
      }

      const summary = await practiceListService.create({
        description,
        title,
        isPublic,
        isOfficial,
      })
      const practiceList = await practiceListService.detail(summary.id, true)
      this.lists.push(practiceList)

      if (!this.defaultListId) {
        this.defaultListId = practiceList.id
      }

      this.persist()
      return practiceList
    },

    async updatePracticeList(listId, changes = {}) {
      const practiceList = findPracticeList(this.lists, listId)
      const normalizedChanges =
        changes && typeof changes === 'object' && !Array.isArray(changes) ? changes : {}

      if (!practiceList) {
        return false
      }

      if (this.authenticated) {
        await practiceListService.update(listId, normalizedChanges)
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

      if (Object.hasOwn(normalizedChanges, 'isPublic')) {
        practiceList.isPublic = Boolean(normalizedChanges.isPublic)
      }

      practiceList.updatedAt = getCurrentTimestamp()
      this.persist()
      return true
    },

    async deletePracticeList(listId) {
      const normalizedListId = String(listId ?? '').trim()
      const nextLists = this.lists.filter((list) => list.id !== normalizedListId)

      if (nextLists.length === this.lists.length) {
        return false
      }

      if (this.authenticated) await practiceListService.delete(normalizedListId)

      this.lists = nextLists

      if (this.defaultListId === normalizedListId) {
        this.defaultListId = this.lists[0]?.id ?? null
      }

      this.persist()
      return true
    },

    async setDefaultPracticeList(listId) {
      const practiceList = findPracticeList(this.lists, listId)

      if (!practiceList) {
        return false
      }

      if (this.authenticated) await practiceListService.setDefault(practiceList.id)

      this.defaultListId = practiceList.id
      this.persist()
      return true
    },

    async addProblemsToPracticeList(listId, problemIds) {
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

      if (this.authenticated) {
        const result = await practiceListService.addItems(listId, newlyAddedProblemIds)
        newlyAddedProblemIds.splice(0, newlyAddedProblemIds.length, ...(result.added ?? []))
        if (newlyAddedProblemIds.length === 0) return []
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

    async removeProblemFromPracticeList(listId, problemId) {
      return (await this.removeProblemsFromPracticeList(listId, [problemId])).length > 0
    },

    async removeProblemsFromPracticeList(listId, problemIds) {
      const practiceList = findPracticeList(this.lists, listId)
      const normalizedProblemIds = new Set(normalizeProblemIds(problemIds))

      if (!practiceList || normalizedProblemIds.size === 0) {
        return []
      }

      const removedProblemIds = practiceList.items
        .filter((item) => normalizedProblemIds.has(item.problemId))
        .map((item) => item.problemId)

      if (removedProblemIds.length === 0) {
        return []
      }

      if (this.authenticated) {
        if (removedProblemIds.length === 1) {
          await practiceListService.removeItem(listId, removedProblemIds[0])
        } else {
          await practiceListService.removeItems(listId, removedProblemIds)
        }
      }

      practiceList.items = practiceList.items.filter(
        (item) => !normalizedProblemIds.has(item.problemId),
      )
      practiceList.updatedAt = getCurrentTimestamp()
      this.persist()
      return removedProblemIds
    },

    async updateProblemNote(listId, problemId, note) {
      const practiceList = findPracticeList(this.lists, listId)
      const normalizedProblemId = String(problemId ?? '').trim()
      const item = practiceList?.items.find(
        (currentItem) => currentItem.problemId === normalizedProblemId,
      )

      if (!practiceList || !item) {
        return false
      }

      if (this.authenticated) await practiceListService.updateNote(listId, normalizedProblemId, note)

      item.note = String(note ?? '').trim()
      practiceList.updatedAt = getCurrentTimestamp()
      return this.persist()
    },

    async moveProblemInPracticeList(listId, problemId, targetIndex) {
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

      if (this.authenticated) {
        const orderedIds = practiceList.items.map((item) => item.problemId)
        const [movedId] = orderedIds.splice(currentIndex, 1)
        orderedIds.splice(normalizedTargetIndex, 0, movedId)
        await practiceListService.reorder(listId, orderedIds)
      }

      const [item] = practiceList.items.splice(currentIndex, 1)
      practiceList.items.splice(normalizedTargetIndex, 0, item)
      practiceList.updatedAt = getCurrentTimestamp()
      this.persist()
      return true
    },
  },
})
