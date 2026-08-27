export const USER_PROFILE_PROTOTYPE = Object.freeze({
  avatarUrl: '',
  joinedAt: '待接入',
  role: '数海用户',
  signature: '用户签名将在个人资料接口接入后显示在这里。',
  uid: '待接入',
  username: '示例用户',
})

export const USER_PROFILE_STATS_PROTOTYPE = Object.freeze([
  {
    key: 'completed',
    label: '已完成题目',
    value: '—',
    description: '等待学习记录接口',
  },
  {
    key: 'uploaded',
    label: '上传题目',
    value: '—',
    description: '等待用户贡献接口',
  },
  {
    key: 'favorites',
    label: '收藏题目',
    value: '—',
    description: '不会读取本机收藏',
  },
  {
    key: 'streak',
    label: '连续学习天数',
    value: '—',
    description: '等待学习统计接口',
  },
])

export const USER_RECENT_ACTIVITY_PROTOTYPE = Object.freeze([])

export const USER_SETTINGS_TABS = Object.freeze([
  { key: 'profile', label: '个人设置', routeName: 'user-settings-profile' },
  { key: 'preferences', label: '偏好设置', routeName: 'user-settings-preferences' },
  { key: 'security', label: '安全设置', routeName: 'user-settings-security' },
])
