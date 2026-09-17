import {
  ADMIN_LEVEL_OPTIONS,
  ADMIN_PROTOTYPE_PROBLEMS,
  ADMIN_PROTOTYPE_USERS,
  ADMIN_SOURCE_OPTIONS,
  ADMIN_TAG_OPTIONS,
  ADMIN_TYPE_OPTIONS,
} from '../config/admin.js'

const DEFAULT_PAGE_SIZE = 20

function clone(value) {
  return structuredClone(value)
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function findOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? ''
}

function normalizeKeyword(value) {
  return normalizeText(value).toLocaleLowerCase('zh-CN')
}

function normalizePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

function paginate(items, query = {}) {
  const pageSize = normalizePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(normalizePositiveInteger(query.page, 1), pageCount)
  const offset = (page - 1) * pageSize

  return {
    items: clone(items.slice(offset, offset + pageSize)),
    pagination: {
      page,
      pageSize,
      total,
      hasNext: page < pageCount,
    },
  }
}

function normalizeProblem(problem) {
  const id = normalizeText(problem.id).toUpperCase()
  const year = normalizeText(problem.year)
  const source = normalizeText(problem.source)
  const sourceLabel = findOptionLabel(ADMIN_SOURCE_OPTIONS, source)
  const type = normalizeText(problem.type)

  return {
    id,
    title: normalizeText(problem.title),
    detail: normalizeText(problem.detail),
    year,
    source,
    sourceLabel,
    type,
    typeLabel: findOptionLabel(ADMIN_TYPE_OPTIONS, type),
    level: normalizeText(problem.level),
    tags: Array.from(new Set((problem.tags ?? []).map(normalizeText).filter(Boolean))),
    content: normalizeText(problem.content),
    answer: normalizeText(problem.answer),
    solution: normalizeText(problem.solution),
    sourceText: [year, sourceLabel].filter(Boolean).join(' · '),
    stats: clone(problem.stats ?? { views: 0, passes: 0, downloads: 0, favorites: 0 }),
  }
}

let users = clone(ADMIN_PROTOTYPE_USERS)
let problems = clone(ADMIN_PROTOTYPE_PROBLEMS)

export const adminPrototypeService = {
  async getSummary() {
    const bannedUsers = users.filter((user) => user.status === 'banned').length

    return {
      users: {
        total: users.length,
        active: users.length - bannedUsers,
        banned: bannedUsers,
      },
      problems: {
        total: problems.length,
      },
    }
  },

  async getUsers(query = {}) {
    const keyword = normalizeKeyword(query.keyword)
    const status = normalizeText(query.status)
    const filteredUsers = users.filter((user) => {
      const matchesStatus = !status || user.status === status
      const matchesKeyword =
        !keyword ||
        [user.username, user.uid, user.role, user.status]
          .join(' ')
          .toLocaleLowerCase('zh-CN')
          .includes(keyword)

      return matchesStatus && matchesKeyword
    })

    return paginate(filteredUsers, query)
  },

  async getProblemCatalogs() {
    return {
      levels: clone(ADMIN_LEVEL_OPTIONS),
      sources: clone(ADMIN_SOURCE_OPTIONS),
      tags: clone(ADMIN_TAG_OPTIONS),
      types: clone(ADMIN_TYPE_OPTIONS),
    }
  },

  async getProblems(query = {}) {
    const keyword = normalizeKeyword(query.keyword)
    const filteredProblems = problems.filter(
      (problem) =>
        !keyword ||
        [
          problem.id,
          problem.title,
          problem.detail,
          problem.sourceLabel,
          problem.typeLabel,
          problem.content,
          ...problem.tags,
        ]
          .join(' ')
          .toLocaleLowerCase('zh-CN')
          .includes(keyword),
    )

    return paginate(filteredProblems, query)
  },

  async getProblem(problemId) {
    const problem = problems.find((item) => item.id === problemId)
    if (!problem) throw new Error('没有找到这道演示题目')
    return clone(problem)
  },

  async updateUserStatus(userId, status) {
    const user = users.find((item) => item.id === userId)

    if (!user) {
      throw new Error('没有找到这个演示用户')
    }

    if (user.role === 'admin') {
      throw new Error('演示管理员账号不能修改状态')
    }

    user.status = status

    return {
      item: clone(user),
      message: status === 'banned' ? '已在本次演示中封禁用户' : '已在本次演示中解除封禁',
    }
  },

  async createProblem(value) {
    const problem = normalizeProblem(value)

    if (!problem.id || !problem.content) {
      throw new Error('题目编号和题面不能为空')
    }

    if (problems.some((item) => item.id === problem.id)) {
      throw new Error('这个题目编号已存在')
    }

    problems.unshift(problem)

    return {
      item: clone(problem),
      message: '已在本次演示中新增题目',
    }
  },

  async updateProblem(problemId, value) {
    const index = problems.findIndex((item) => item.id === problemId)

    if (index === -1) {
      throw new Error('没有找到这道演示题目')
    }

    const problem = normalizeProblem({ ...value, id: problemId })

    if (!problem.content) {
      throw new Error('题面不能为空')
    }

    problems[index] = problem

    return {
      item: clone(problem),
      message: '已在本次演示中保存题目修改',
    }
  },
}
