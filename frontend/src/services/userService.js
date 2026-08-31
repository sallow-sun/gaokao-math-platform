import { apiRequest } from './apiClient.js'

function formatJoinedAt(value) {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function normalizePublicProfile(value) {
  const typeLabels = {
    'single-choice': ['单项选择题', 'red'],
    'multiple-choice': ['多项选择题', 'yellow'],
    'fill-blank': ['填空题', 'green'],
    solution: ['解答题', 'blue'],
  }
  const typeCounts = new Map(
    (value?.typeStats ?? []).map((item) => [String(item.type), Number(item.count) || 0]),
  )
  const tagGroups = new Map()
  ;(value?.tagStats ?? []).forEach((item) => {
    const tag = String(item.tag ?? '')
    if (!tag) return
    if (!tagGroups.has(tag)) tagGroups.set(tag, [])
    tagGroups.get(tag).push({ level: String(item.level ?? ''), count: Number(item.count) || 0 })
  })

  return {
    id: Number(value?.id),
    publicId: String(value?.publicId ?? ''),
    uid: String(value?.uid ?? ''),
    username: String(value?.username ?? ''),
    avatarUrl: String(value?.avatarUrl ?? ''),
    signature: String(value?.signature ?? '').trim() || '还没有填写个人签名',
    role: String(value?.role ?? 'USER'),
    joinedAt: formatJoinedAt(value?.joinedAt),
    stats: value?.stats ?? {},
    recentActivity: Array.isArray(value?.recentActivity) ? value.recentActivity : [],
    dailyActivity: Array.isArray(value?.dailyActivity)
      ? value.dailyActivity.map((item) => ({ date: item.date, count: Number(item.count) || 0 }))
      : [],
    typeStats: Object.entries(typeLabels).map(([key, [label, color]]) => ({
      key,
      label,
      color,
      value: typeCounts.get(key) ?? 0,
    })),
    tagStats: Array.from(tagGroups, ([label, segments]) => ({
      key: label,
      label,
      segments,
    })),
    canEdit: Boolean(value?.canEdit),
  }
}

export const userService = {
  async publicProfile(userId) {
    const profile = await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}`)
    return normalizePublicProfile(profile)
  },
}
