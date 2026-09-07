import { computed, onMounted, ref } from 'vue'

const DEFAULT_PAGE_SIZE = 20
const REQUIRED_SERVICE_METHODS = [
  'getSummary',
  'getUsers',
  'getProblemCatalogs',
  'getProblems',
  'getProblem',
  'updateUserStatus',
  'deleteUser',
  'createProblem',
  'updateProblem',
  'deleteProblem',
]

function createEmptyPagination(pageSize = DEFAULT_PAGE_SIZE) {
  return {
    page: 1,
    pageSize,
    total: 0,
    hasNext: false,
  }
}

function normalizeError(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

function assertService(service) {
  const missingMethod = REQUIRED_SERVICE_METHODS.find(
    (methodName) => typeof service?.[methodName] !== 'function',
  )

  if (missingMethod) {
    throw new TypeError(`Admin service is missing method: ${missingMethod}`)
  }
}

export function useAdminDashboard(service, { pageSize = DEFAULT_PAGE_SIZE } = {}) {
  assertService(service)

  const summary = ref(null)
  const summaryLoading = ref(true)
  const summaryError = ref('')

  const users = ref([])
  const usersLoading = ref(true)
  const usersError = ref('')
  const usersPagination = ref(createEmptyPagination(pageSize))
  const usersQuery = ref({
    keyword: '',
    status: '',
    page: 1,
    pageSize,
    sort: 'joinedAt-desc',
  })

  const problems = ref([])
  const problemsLoading = ref(true)
  const problemsError = ref('')
  const problemsPagination = ref(createEmptyPagination(pageSize))
  const problemsQuery = ref({
    keyword: '',
    page: 1,
    pageSize,
    sort: 'id-desc',
  })

  const catalogsLoading = ref(true)
  const catalogsError = ref('')
  const levelOptions = ref([])
  const sourceOptions = ref([])
  const tagOptions = ref([])
  const typeOptions = ref([])

  let usersRequestId = 0
  let problemsRequestId = 0

  const statistics = computed(() => [
    { key: 'users', label: '用户总数', value: summary.value?.users.total ?? '—' },
    { key: 'active', label: '可用账号', value: summary.value?.users.active ?? '—' },
    { key: 'banned', label: '已封禁', value: summary.value?.users.banned ?? '—' },
    { key: 'problems', label: '题目总数', value: summary.value?.problems.total ?? '—' },
  ])

  async function loadSummary() {
    summaryLoading.value = true
    summaryError.value = ''

    try {
      summary.value = await service.getSummary()
    } catch (error) {
      summaryError.value = normalizeError(error, '无法读取管理数据概览')
    } finally {
      summaryLoading.value = false
    }
  }

  async function loadUsers(query = {}) {
    const requestId = ++usersRequestId
    usersQuery.value = { ...usersQuery.value, ...query }
    usersLoading.value = true
    usersError.value = ''

    try {
      const result = await service.getUsers(usersQuery.value)

      if (requestId !== usersRequestId) {
        return
      }

      users.value = result.items
      usersPagination.value = result.pagination
    } catch (error) {
      if (requestId === usersRequestId) {
        users.value = []
        usersError.value = normalizeError(error, '无法读取用户列表')
      }
    } finally {
      if (requestId === usersRequestId) {
        usersLoading.value = false
      }
    }
  }

  async function loadProblemCatalogs() {
    catalogsLoading.value = true
    catalogsError.value = ''

    try {
      const catalogs = await service.getProblemCatalogs()
      levelOptions.value = catalogs.levels
      sourceOptions.value = catalogs.sources
      tagOptions.value = catalogs.tags
      typeOptions.value = catalogs.types
    } catch (error) {
      catalogsError.value = normalizeError(error, '无法读取题目目录')
    } finally {
      catalogsLoading.value = false
    }
  }

  async function loadProblems(query = {}) {
    const requestId = ++problemsRequestId
    problemsQuery.value = { ...problemsQuery.value, ...query }
    problemsLoading.value = true
    problemsError.value = ''

    try {
      const result = await service.getProblems(problemsQuery.value)

      if (requestId !== problemsRequestId) {
        return
      }

      problems.value = result.items
      problemsPagination.value = result.pagination
    } catch (error) {
      if (requestId === problemsRequestId) {
        problems.value = []
        problemsError.value = normalizeError(error, '无法读取题目列表')
      }
    } finally {
      if (requestId === problemsRequestId) {
        problemsLoading.value = false
      }
    }
  }

  async function loadDashboard() {
    await Promise.all([loadSummary(), loadUsers(), loadProblemCatalogs(), loadProblems()])
  }

  async function updateUserStatus(userId, status) {
    return service.updateUserStatus(userId, status)
  }

  async function deleteUser(userId) {
    return service.deleteUser(userId)
  }

  async function createProblem(value) {
    return service.createProblem(value)
  }

  async function getProblem(problemId) {
    return service.getProblem(problemId)
  }

  async function updateProblem(problemId, value) {
    return service.updateProblem(problemId, value)
  }

  async function deleteProblem(problemId) {
    return service.deleteProblem(problemId)
  }

  onMounted(() => {
    void loadDashboard()
  })

  return {
    catalogsError,
    catalogsLoading,
    levelOptions,
    problems,
    problemsError,
    problemsLoading,
    problemsPagination,
    problemsQuery,
    sourceOptions,
    statistics,
    summaryError,
    summaryLoading,
    tagOptions,
    typeOptions,
    users,
    usersError,
    usersLoading,
    usersPagination,
    usersQuery,
    createProblem,
    deleteProblem,
    deleteUser,
    getProblem,
    loadDashboard,
    loadProblemCatalogs,
    loadProblems,
    loadSummary,
    loadUsers,
    updateProblem,
    updateUserStatus,
  }
}
