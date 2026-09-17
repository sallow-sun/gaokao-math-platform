import { DIFFICULTY_LEVELS } from './editorialImport.js'

// Explicit rule 1.2 templates; no inference for unknown paper types.
export const DIFFICULTY_TEMPLATES = [
  {
    id: 'new19',
    label: '新高考19题',
    levels: [1, 1, 1, 2, 2, 3, 4, 5, 2, 4, 6, 1, 3, 6, 3, 4, 5, 6, 7],
  },
  {
    id: 'new22',
    label: '新高考22题',
    levels: [1, 1, 1, 2, 2, 3, 4, 5, 2, 3, 4, 6, 1, 2, 4, 6, 3, 4, 4, 5, 6, 7],
  },
  {
    id: 'old23',
    label: '老高考23题（含选考）',
    levels: [1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 1, 3, 4, 6, 3, 4, 5, 6, 7, 5, 5],
  },
  {
    id: 'tianjin20',
    label: '天津20题',
    levels: [1, 1, 2, 2, 3, 4, 4, 5, 6, 1, 2, 3, 3, 5, 6, 3, 4, 5, 6, 7],
  },
  {
    id: 'shanghai21',
    label: '上海21题',
    levels: [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 1, 2, 4, 5, 3, 4, 5, 6, 7],
  },
  {
    id: 'beijing21',
    label: '北京21题',
    levels: [1, 1, 1, 1, 2, 2, 3, 4, 5, 6, 2, 3, 3, 4, 6, 3, 4, 5, 5, 6, 7],
  },
]

export function suggestedDifficulty(templateId, number) {
  if (!/^\d+$/.test(String(number))) return null
  const d = DIFFICULTY_TEMPLATES.find((template) => template.id === templateId)?.levels[
    Number(number) - 1
  ]
  return d ? { code: DIFFICULTY_LEVELS[d - 1], label: `D${d}` } : null
}
