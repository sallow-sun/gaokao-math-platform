export const USER_PROFILE_PROTOTYPE = Object.freeze({
  avatarUrl: '',
  joinedAt: '待接入',
  level: null,
  role: '数海用户',
  signature: '还没有填写个人签名',
  uid: '待接入',
  username: '示例用户',
})

export const USER_PROFILE_STATS_PROTOTYPE = Object.freeze([
  {
    key: 'completed',
    label: '已完成题目',
    value: '—',
    description: '累计标记为已做',
  },
  {
    key: 'streak',
    label: '连续学习',
    value: '—',
    description: '最近连续学习天数',
  },
  {
    key: 'active-days',
    label: '活跃天数',
    value: '—',
    description: '有做题记录的日期',
  },
  {
    key: 'favorites',
    label: '收藏题目',
    value: '—',
    description: '允许公开的收藏数量',
  },
])

export const USER_ACTIVITY_PROTOTYPE = Object.freeze([])

export const USER_PROBLEM_TYPE_STATS_PROTOTYPE = Object.freeze([
  { key: 'single-choice', label: '单项选择题', value: null, color: 'red' },
  { key: 'multiple-choice', label: '多项选择题', value: null, color: 'yellow' },
  { key: 'fill-blank', label: '填空题', value: null, color: 'green' },
  { key: 'solution', label: '解答题', value: null, color: 'blue' },
])

export const USER_TAG_STATS_PROTOTYPE = Object.freeze([
  { key: 'function', label: '函数', segments: Object.freeze([]) },
  { key: 'derivative', label: '导数', segments: Object.freeze([]) },
  { key: 'sequence', label: '数列', segments: Object.freeze([]) },
  { key: 'solid-geometry', label: '立体几何', segments: Object.freeze([]) },
  { key: 'analytic-geometry', label: '解析几何', segments: Object.freeze([]) },
  { key: 'conic-section', label: '圆锥曲线', segments: Object.freeze([]) },
])

export const USER_SETTINGS_TABS = Object.freeze([
  { key: 'preferences', label: '偏好设置', routeName: 'user-settings-preferences' },
  { key: 'security', label: '安全设置', routeName: 'user-settings-security' },
])
