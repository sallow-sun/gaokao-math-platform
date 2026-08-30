import { USER_PROFILE_PROTOTYPE } from './account.js'
import {
  PROBLEMS_LEVEL_OPTIONS,
  PROBLEMS_PROTOTYPE_ITEMS,
  PROBLEMS_SOURCE_CATALOG_OPTIONS,
  PROBLEMS_TYPE_CATALOG_OPTIONS,
} from './problems.js'

export const ADMIN_TABS = Object.freeze([
  { key: 'users', label: '用户管理' },
  { key: 'problems', label: '题目管理' },
])

export const ADMIN_LEVEL_OPTIONS = Object.freeze(
  PROBLEMS_LEVEL_OPTIONS.filter((option) => option.value),
)

export const ADMIN_SOURCE_OPTIONS = Object.freeze(
  PROBLEMS_SOURCE_CATALOG_OPTIONS.filter((option) => option.value),
)

export const ADMIN_TYPE_OPTIONS = Object.freeze(
  PROBLEMS_TYPE_CATALOG_OPTIONS.filter((option) => option.value),
)

export const ADMIN_TAG_OPTIONS = Object.freeze(
  Array.from(new Set(PROBLEMS_PROTOTYPE_ITEMS.flatMap((problem) => problem.tags))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  ),
)

export const ADMIN_PROTOTYPE_USERS = Object.freeze([
  Object.freeze({
    id: 'admin-preview',
    uid: USER_PROFILE_PROTOTYPE.uid,
    username: '演示管理员',
    role: 'admin',
    status: 'active',
    joinedAt: USER_PROFILE_PROTOTYPE.joinedAt,
  }),
  Object.freeze({
    id: 'student-preview-1',
    uid: 'STUDENT-DEMO-01',
    username: '示例学生一',
    role: 'student',
    status: 'active',
    joinedAt: '待接入',
  }),
  Object.freeze({
    id: 'student-preview-2',
    uid: 'STUDENT-DEMO-02',
    username: '示例学生二',
    role: 'student',
    status: 'banned',
    joinedAt: '待接入',
  }),
])

export const ADMIN_PROTOTYPE_PROBLEMS = Object.freeze(
  PROBLEMS_PROTOTYPE_ITEMS.map((problem) =>
    Object.freeze({
      ...problem,
      answer: problem.answer ?? '',
      solution: problem.solution ?? '',
      tags: Object.freeze([...problem.tags]),
    }),
  ),
)

export function createEmptyAdminProblem() {
  return {
    id: '',
    title: '',
    detail: '',
    year: '',
    source: '',
    type: '',
    level: '',
    tags: [],
    content: '',
    answer: '',
    solution: '',
  }
}
