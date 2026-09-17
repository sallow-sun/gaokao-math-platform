import { computed, reactive } from 'vue'

const context = reactive({
  owner: '',
  type: 'page',
  id: '',
  title: '',
  text: '',
  tags: [],
  answer: '',
  solution: '',
})

export function setAssistantContext(owner, value = {}) {
  Object.assign(context, {
    owner,
    type: value.type || 'page',
    id: String(value.id || ''),
    title: String(value.title || ''),
    text: String(value.text || ''),
    tags: Array.isArray(value.tags) ? value.tags.map(String) : [],
    answer: String(value.answer || ''),
    solution: String(value.solution || ''),
  })
}

export function clearAssistantContext(owner) {
  if (context.owner !== owner) return
  Object.assign(context, { owner: '', type: 'page', id: '', title: '', text: '', tags: [], answer: '', solution: '' })
}

export function useAssistantContext(route) {
  const effectiveContext = computed(() => {
    if (context.owner) return context
    return {
      owner: 'route',
      type: 'page',
      id: String(route.name || ''),
      title: String(route.meta?.title || document.title || '当前页面'),
      text: '',
      tags: [],
      answer: '',
      solution: '',
    }
  })
  return { context, effectiveContext }
}

