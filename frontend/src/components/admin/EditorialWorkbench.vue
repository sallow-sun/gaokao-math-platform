<script setup>
import FeedbackQueue from './FeedbackQueue.vue'
import ProblemRecycleBin from './ProblemRecycleBin.vue'
import { apiRequest } from '../../services/apiClient.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import CurriculumEditor from '../curriculum/CurriculumEditor.vue'
import CurriculumSettings from '../curriculum/CurriculumSettings.vue'
import MathText from '../content/MathText.vue'
import { editorialService as api } from '../../services/editorialService.js'
import { DIFFICULTY_LEVELS, prepareImport } from '../../utils/editorialImport.js'
import { DIFFICULTY_TEMPLATES, suggestedDifficulty } from '../../utils/difficultyTemplates.js'
import { renderMathText } from '../../utils/renderMathText.js'
import '../../assets/styles/editorial.css'
import '../../assets/styles/editorial-review.css'

// Keep just one next question leased: instant handoff without a stale editable snapshot.
const prepared = ref(null)
const publishing = ref(null)
const switching = ref(false)
const publishFailure = ref(null)
const publishStatus = ref('')
let preparation = 0
let preparationController
let openingId = null
let disposed = false
function clearPrepared() {
  preparation++
  preparationController?.abort()
  const old = prepared.value
  prepared.value = null
  if (old && old.value.id !== item.value?.id)
    void api.remove(`/items/${old.value.id}/lease`).catch(() => {})
}
async function prepareNext() {
  if (
    prepared.value &&
    Date.now() - prepared.value.at < 15 * 60 * 1000 &&
    tab.value === 'queue' &&
    item.value &&
    prepared.value.value.id !== item.value.id &&
    (prepared.value.batch || queue.value.items.some((q) => q.id === prepared.value.value.id)) &&
    !feedbackTask.value &&
    !publishFailure.value
  )
    return
  clearPrepared()
  if (
    disposed ||
    tab.value !== 'queue' ||
    !item.value ||
    feedbackTask.value ||
    publishFailure.value
  )
    return
  const generation = preparation
  const current = item.value.id
  const index = queue.value.items.findIndex((q) => q.id === current)
  const candidates = [
    ...queue.value.items.slice(index + 1),
    ...queue.value.items.slice(0, Math.max(index, 0)),
  ].filter((q) => q.id !== current && q.id !== publishing.value)
  const query = new URLSearchParams({
    status: status.value,
    issue: issue.value,
    keyword: keyword.value,
    page: queue.value.page,
  })
  if (paperId.value) query.set('paperId', paperId.value)
  const lastPage = Math.max(queue.value.page, Math.ceil(queue.value.total / 40))
  const controller = new AbortController()
  preparationController = controller
  const prefetchTimer = setTimeout(() => controller.abort(), 10000)
  void (async () => {
    const attempt = async (candidate, batch) => {
      if (disposed || generation !== preparation) return true
      try {
        const value = await api.post(
          `/items/${candidate.id}/lease`,
          {},
          { signal: controller.signal },
        )
        if (disposed || generation !== preparation) {
          if (value.id !== item.value?.id && value.id !== openingId)
            void api.remove(`/items/${value.id}/lease`).catch(() => {})
          return true
        }
        prepared.value = { value, at: Date.now(), batch }
        for (const section of ['content', 'answer', 'solution'])
          renderMathText(value.document[section] || '')
        for (const asset of value.document.assets || []) {
          if (asset.url?.startsWith('/uploads/')) {
            const image = new Image()
            image.src = asset.url
            void image.decode().catch(() => {})
          }
        }
        return true
      } catch (error) {
        if (error.code !== 'CLAIMED' && error.code !== 'PROBLEM_DELETED') throw error
        return false
      }
    }
    try {
      for (const candidate of candidates) if (await attempt(candidate)) return
      for (let page = Number(query.get('page')); page <= lastPage; page++) {
        if (disposed || generation !== preparation) return
        query.set('page', page)
        const batch = await api.get(`/items?${query}`, { signal: controller.signal })
        for (const candidate of batch.items) {
          if (
            candidate.id === current ||
            candidate.id === publishing.value ||
            candidates.some((q) => q.id === candidate.id)
          )
            continue
          if (await attempt(candidate, batch)) return
        }
      }
    } catch {
      /* Prefetch failure never blocks the foreground navigation. */
    } finally {
      clearTimeout(prefetchTimer)
    }
  })()
}
async function advanceWhilePublishing(previousId) {
  switching.value = true
  busy.value = true
  const index = queue.value.items.findIndex((q) => q.id === previousId)
  const candidates = [
    ...queue.value.items.slice(index + 1),
    ...queue.value.items.slice(0, Math.max(index, 0)),
  ]
  const controller = new AbortController()
  const navigationTimer = setTimeout(() => controller.abort(), 12000)
  try {
    // Use only a completed prefetch; never wait on background cleanup or loading.
    if (prepared.value && prepared.value.value.id !== previousId) {
      await openInternal(prepared.value.value.id, controller.signal)
      return
    }
    for (const candidate of candidates) {
      if (candidate.id === previousId) continue
      try {
        await openInternal(candidate.id, controller.signal)
        return
      } catch (error) {
        if (error.code !== 'CLAIMED' && error.code !== 'PROBLEM_DELETED') throw error
      }
    }
    // At a page boundary fetch the remaining queue while the old question is saving.
    const lastPage = Math.max(queue.value.page, Math.ceil(queue.value.total / 40))
    for (let page = queue.value.page; page <= lastPage; page++) {
      const query = new URLSearchParams({
        status: status.value,
        issue: issue.value,
        keyword: keyword.value,
        page,
      })
      if (paperId.value) query.set('paperId', paperId.value)
      const batch = await api.get(`/items?${query}`, { signal: controller.signal })
      for (const candidate of batch.items) {
        if (candidate.id === previousId || candidates.some((q) => q.id === candidate.id)) continue
        try {
          await openInternal(candidate.id, controller.signal)
          queue.value = batch
          return
        } catch (error) {
          if (error.code !== 'CLAIMED' && error.code !== 'PROBLEM_DELETED') throw error
        }
      }
    }
    item.value = null
    draft.value = null
    message.value = '当前没有可继续审核的题目'
  } catch (error) {
    item.value = null
    draft.value = null
    message.value = `下一题加载失败：${error.message}。请点击开始 / 继续审核重试。`
  } finally {
    clearTimeout(navigationTimer)
    switching.value = false
    busy.value = false
  }
}
async function publishInBackground() {
  const previous = clone(item.value)
  const snapshot = clone(draft.value)
  const operationNote = note.value
  const changed = dirty.value
  const key = recoveryKey()
  const next =
    prepared.value && Date.now() - prepared.value.at < 15 * 60 * 1000 ? prepared.value.value : null
  if (next) {
    if (prepared.value.batch) queue.value = prepared.value.batch
    prepared.value = null
    preparation++
  }
  clearTimeout(recoveryTimer)
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: previous.version,
        document: snapshot,
        savedAt: new Date().toISOString(),
      }),
    )
  } catch {
    /* Keep the snapshot in memory too. */
  }
  publishing.value = previous.id
  publishStatus.value = '上一题正在后台保存…'
  message.value = ''
  if (next) adopt(next)
  editing.value = false
  editorTab.value = 'content'
  note.value = ''
  returnOpen.value = false
  const handoff = next ? Promise.resolve() : advanceWhilePublishing(previous.id)
  await nextTick()
  document.querySelector('.editorial-edit-scroll')?.scrollTo(0, 0)
  try {
    let version = previous.version
    if (changed) {
      const saved = await api.put(`/items/${previous.id}`, {
        version,
        document: snapshot,
        note: operationNote,
      })
      version = saved.version
    }
    await api.post(`/items/${previous.id}/actions`, {
      version,
      action: 'PUBLISH',
      note: operationNote,
    })
    try {
      localStorage.removeItem(key)
    } catch {
      /* Server save succeeded. */
    }
    publishStatus.value = '上一题已保存'
    if (publishFailure.value?.id === previous.id) publishFailure.value = null
    // Do not refresh the active editor or overwrite edits made while publishing.
    if (queue.value.items.some((q) => q.id === previous.id)) {
      queue.value.items = queue.value.items.filter((q) => q.id !== previous.id)
      queue.value.total = Math.max(0, queue.value.total - 1)
    }
  } catch (error) {
    publishFailure.value = { id: previous.id, document: snapshot, note: operationNote }
    publishStatus.value = `上一题未确认保存：${error.message || '网络异常'}。请返回该题核对后重试。`
  } finally {
    await handoff
    publishing.value = null
    if (item.value?.id !== previous.id)
      void api.remove(`/items/${previous.id}/lease`).catch(() => {})
  }
}
async function reopenFailed() {
  const failed = publishFailure.value
  if (!failed || !discardAllowed()) return
  await run(async () => {
    await openInternal(failed.id)
    note.value = failed.note
    if (item.value.status === 'PUBLISHED') {
      publishFailure.value = null
      publishStatus.value = '已核实：该题已发布，无需重复提交'
    } else {
      draft.value = clone(failed.document)
      editing.value = true
      publishStatus.value = '已保留上次修改，请核对后重新点击通过'
    }
  })
}

const props = defineProps({
  tags: { type: Array, default: () => [] },
  sources: { type: Array, default: () => [] },
})
const me = ref(null),
  tab = ref('queue'),
  message = ref(''),
  busy = ref(false)
const papers = ref([]),
  queue = ref({ items: [], total: 0, page: 1 }),
  status = ref('PENDING'),
  paperId = ref(''),
  keyword = ref('')
const editorTab = ref('content')
const directoryOpen = ref(false)
const deleteMode = ref(false),
  deleteSelected = ref([])
const deletionEntries = computed(() =>
  tab.value === 'published' ? published.value : queue.value.items,
)
function startDeletion() {
  deleteMode.value = true
  deleteSelected.value = []
  if (tab.value === 'queue') directoryOpen.value = true
}
const feedbackTask = ref(null)
const queuePositions = new Map()
const editing = ref(false),
  issue = ref(''),
  returnOpen = ref(false),
  returnType = ref('其他'),
  settingsOpen = ref(false)
let leaseTimer
const item = ref(null),
  draft = ref(null),
  baseline = ref(''),
  note = ref(''),
  historyDocument = ref(null),
  conflict = ref(null)
const importEntries = ref([]),
  groups = ref([]),
  batchId = ref(''),
  batchTitle = ref(''),
  importing = ref(false),
  stopImport = ref(false)
const batches = ref([]),
  batchEntries = ref([]),
  members = ref([]),
  published = ref([]),
  publishedPage = ref(1),
  publishedTotal = ref(0)
const importPage = ref(1),
  importPreview = ref(''),
  activeSection = ref('content'),
  recovery = ref(null)
const templateId = ref('')
const difficultySuggestion = computed(() =>
  suggestedDifficulty(templateId.value, item.value?.original_number),
)
const formulaWarnings = computed(() =>
  ['content', 'answer', 'solution'].filter((section) =>
    renderMathText(draft.value?.[section] || '').includes('class="katex-error"'),
  ),
)
const isReviewer = computed(() => me.value && me.value.permission !== 'EDITOR')
const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== baseline.value)
const sourceCategory = computed({
  get: () => draft.value?.originalMetadata?.source_category || '',
  set: (value) => {
    draft.value.originalMetadata = { ...draft.value.originalMetadata, source_category: value }
  },
})
const visibleImports = computed(() =>
  importEntries.value.slice((importPage.value - 1) * 40, importPage.value * 40),
)
const completedImports = computed(
  () => importEntries.value.filter((e) => e.result !== 'READY').length,
)
const typeOptions = [
  { value: 'single-choice', label: '单选题' },
  { value: 'multiple-choice', label: '多选题' },
  { value: 'fill-blank', label: '填空题' },
  { value: 'solution', label: '解答题' },
]
const statusLabels = {
  DRAFT: '初审',
  CHANGES: '待修改',
  REVIEW: '待复核',
  PUBLISHED: '已发布',
  READY: '待导入',
  IMPORTED: '已导入',
  SKIPPED: '已跳过',
  CONFLICT: '存在差异',
  FAILED: '失败',
}
const clone = (value) => JSON.parse(JSON.stringify(value))
watch([tab, status, paperId, keyword, publishedPage, () => queue.value.page], () => {
  deleteSelected.value = []
  deleteMode.value = false
})
let recoveryTimer
const recoveryKey = () => `mathsea:editorial:${me.value?.id}:${item.value?.id}`

async function run(action) {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    return await action()
  } catch (error) {
    message.value = error.message || '操作失败，请重试'
    if (error.code === 'EDIT_CONFLICT' && item.value)
      conflict.value = await api.get(`/items/${item.value.id}`).catch(() => null)
  } finally {
    busy.value = false
  }
}
async function refresh() {
  const query = new URLSearchParams({
    status: status.value,
    issue: issue.value,
    keyword: keyword.value,
    page: queue.value.page,
  })
  if (paperId.value) query.set('paperId', paperId.value)
  queue.value = await api.get(`/items?${query}`)
  deleteSelected.value = []
  const lastPage = Math.max(1, Math.ceil(queue.value.total / 40))
  if (queue.value.page > lastPage) {
    queue.value.page = lastPage
    return refresh()
  }
}
function previewText(section) {
  let text = draft.value?.[section] || ''
  for (const asset of draft.value?.assets || [])
    text = text.replaceAll(`](${asset.altText})`, `](${asset.url})`)
  return text
}
function discardAllowed() {
  return (
    !dirty.value || window.confirm('当前修改尚未保存到服务器。离开后可从本机草稿恢复，仍要继续吗？')
  )
}
function forgetRecovery() {
  localStorage.removeItem(recoveryKey())
  recovery.value = null
}
function loadConflict() {
  if (window.confirm('放弃编辑区修改并加载服务器版本？')) adopt(conflict.value)
}
function removeReference(reference) {
  if (window.confirm('确认此题不再需要这条图片引用？'))
    draft.value.imageReferences = draft.value.imageReferences.filter((r) => r !== reference)
}
function restoreHistory(id) {
  if (window.confirm('将此版本恢复为新草稿？公开版本保持不变。')) void action('RESTORE', id)
}
function adopt(value) {
  item.value = value
  draft.value = clone(value.document)
  baseline.value = JSON.stringify(draft.value)
  conflict.value = null
  historyDocument.value = null
  recovery.value = null
  try {
    const saved = JSON.parse(localStorage.getItem(recoveryKey()) || 'null')
    if (saved && JSON.stringify(saved.document) !== baseline.value) recovery.value = saved
  } catch {
    /* Local storage is optional; server saves remain authoritative. */
  }
}
async function open(id) {
  if (!discardAllowed()) return
  feedbackTask.value = null
  await run(async () => {
    await openInternal(id)
    tab.value = 'queue'
  })
}
async function releaseCurrent() {
  if (item.value && item.value.id !== publishing.value)
    await api.remove(`/items/${item.value.id}/lease`).catch(() => {})
}
async function openInternal(id, signal) {
  openingId = id
  try {
    if (id === publishing.value) throw new Error('该题正在后台保存，请稍候')
    const cached = prepared.value
    if (cached?.value.id === id) {
      if (cached.batch) queue.value = cached.batch
      prepared.value = null
      preparation++
    }
    const value =
      cached?.value.id === id && Date.now() - cached.at < 15 * 60 * 1000
        ? cached.value
        : await api.post(`/items/${id}/lease`, {}, { signal })
    if (item.value?.id !== id) void releaseCurrent()
    adopt(value)
    editing.value = false
    editorTab.value = 'content'
    try {
      localStorage.setItem(`mathsea:review-position:${me.value.id}:${status.value}`, id)
    } catch {
      /* optional */
    }
    returnOpen.value = false
    await nextTick()
    document.querySelector('.editorial-edit-scroll')?.scrollTo(0, 0)
  } finally {
    if (openingId === id) openingId = null
  }
}
async function changeQueue(value) {
  if (!discardAllowed()) return
  feedbackTask.value = null
  await run(async () => {
    await releaseCurrent()
    item.value = null
    draft.value = null
    queuePositions.set(status.value, {
      keyword: keyword.value,
      paper: paperId.value,
      issue: issue.value,
      page: queue.value.page,
    })
    status.value = value
    const saved = queuePositions.get(value)
    keyword.value = saved?.keyword || ''
    paperId.value = saved?.paper || ''
    issue.value = saved?.issue || ''
    queue.value.page = saved?.page || 1
    tab.value = 'queue'
    await refresh()
  })
}
async function markChanges() {
  note.value = `${returnType.value}：${note.value.trim() || '请核对并修正此项'}`
  await action('RETURN')
}
async function startReview() {
  let id
  try {
    id = localStorage.getItem(`mathsea:review-position:${me.value.id}:${status.value}`)
  } catch {
    /* optional */
  }
  const target = queue.value.items.find((q) => q.id === id) || queue.value.items[0]
  if (target) await open(target.id)
}
async function deletePublished(entries) {
  if (!discardAllowed()) return
  if (
    !entries.length ||
    !window.confirm(
      `将以下 ${entries.length} 道已发布题目移入回收站？题目将从公开题库下架，可恢复。\n\n${entries.map((e) => `${e.id} · ${e.title}`).join('\n')}`,
    )
  )
    return
  await run(async () => {
    await apiRequest('/api/v1/admin/problem-trash', {
      method: 'POST',
      body: { numbers: entries.map((e) => e.id) },
    })
    if (entries.some((e) => e.id === item.value?.problem_number)) {
      item.value = null
      draft.value = null
    }
    await refreshPublished()
    await refresh()
    deleteMode.value = false
    message.value = '已移入回收站，可恢复'
  })
}
async function deleteSelection() {
  const entries = deletionEntries.value.filter((e) => deleteSelected.value.includes(e.id))
  if (tab.value === 'published') return deletePublished(entries)
  if (!entries.length || !discardAllowed()) return
  if (
    !window.confirm(
      `将以下 ${entries.length} 道初审草稿移入回收站？可恢复到初审；已有公开版本保持不变。\n\n${entries.map((e) => `${e.problem_number || e.original_id} · ${e.title}`).join('\n')}`,
    )
  )
    return
  await run(async () => {
    await apiRequest('/api/v1/admin/problem-trash/drafts', {
      method: 'POST',
      body: { items: entries.map(({ id, version }) => ({ id, version })) },
    })
    if (entries.some((e) => e.id === item.value?.id)) await nextItem()
    else await refresh()
    deleteMode.value = false
    message.value = `已将 ${entries.length} 道初审草稿移入回收站，可恢复`
  })
}
async function newItem() {
  if (!discardAllowed()) return
  feedbackTask.value = null
  await run(async () => {
    adopt(await api.post('/items'))
    tab.value = 'queue'
    await refresh()
  })
}
async function saveInternal() {
  const value = await api.put(`/items/${item.value.id}`, {
    version: item.value.version,
    document: draft.value,
    note: note.value,
  })
  clearTimeout(recoveryTimer)
  localStorage.removeItem(recoveryKey())
  adopt(value)
  note.value = ''
  message.value = '草稿已保存，公开内容未改变'
}
async function save(next = false) {
  await run(async () => {
    await saveInternal()
    if (next) await nextItem()
    await refresh()
  })
}
async function skipItem() {
  if (!discardAllowed()) return
  feedbackTask.value = null
  await run(nextItem)
}
async function nextItem() {
  const current = item.value?.id
  const index = queue.value.items.findIndex((q) => q.id === current)
  const preferred = queue.value.items[index + 1]?.id
  await refresh()
  if (!queue.value.items.length && queue.value.page > 1) {
    queue.value.page--
    await refresh()
  }
  const candidates = queue.value.items.filter((q) => q.id !== current)
  candidates.sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred))
  await releaseCurrent()
  for (const next of candidates) {
    try {
      await openInternal(next.id)
      return
    } catch (e) {
      if (e.code !== 'CLAIMED') throw e
    }
  }
  item.value = null
  draft.value = null
  message.value = candidates.length
    ? '本页其他题目正在由管理员处理，可切换下一页'
    : '本页处理完毕，可切换分区或下一页'
}
async function action(action, historyId) {
  if (
    busy.value ||
    publishing.value ||
    (publishFailure.value && publishFailure.value.id !== item.value?.id)
  )
    return
  if (action === 'PUBLISH' && !feedbackTask.value) {
    await publishInBackground()
    return
  }
  await run(async () => {
    const operationNote = note.value
    if (dirty.value) await saveInternal()
    const value =
      action === 'PUBLISH' && feedbackTask.value
        ? await apiRequest('/api/v1/admin/feedback/publish', {
            method: 'POST',
            body: {
              item: item.value.id,
              version: item.value.version,
              feedback: feedbackTask.value.items,
            },
          })
        : await api.post(`/items/${item.value.id}/actions`, {
            version: item.value.version,
            action,
            note: operationNote,
            historyId,
          })
    localStorage.removeItem(recoveryKey())
    adopt(value)
    note.value = ''
    message.value = '操作已完成'
    if (publishFailure.value?.id === value.id) {
      publishFailure.value = null
      publishStatus.value = '审核结果已保存'
    }
    if (action === 'PUBLISH' && feedbackTask.value) {
      feedbackTask.value = null
      await releaseCurrent()
      item.value = null
      draft.value = null
      tab.value = 'feedback'
    } else if (['PUBLISH', 'RETURN', 'SUBMIT'].includes(action)) await nextItem()
    await refresh()
  })
}
async function upload(files) {
  if (!item.value || !files?.length) return
  await run(async () => {
    if (dirty.value) await saveInternal()
    for (const file of files) {
      if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024)
        throw new Error(`${file.name}：请使用不超过10MB的 PNG/JPG/GIF/WebP`)
      adopt(await api.upload(item.value, file, activeSection.value))
    }
    message.value = '图片已保存到草稿，可调整说明、归属和顺序'
  })
}
function paste(event) {
  const files = [...(event.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'))
  if (files.length) {
    event.preventDefault()
    void upload(files)
  }
}
function moveImage(index, step) {
  const target = index + step
  if (target < 0 || target >= draft.value.assets.length) return
  ;[draft.value.assets[index], draft.value.assets[target]] = [
    draft.value.assets[target],
    draft.value.assets[index],
  ]
}
function toggleTag(tag) {
  draft.value.tags = draft.value.tags.includes(tag)
    ? draft.value.tags.filter((t) => t !== tag)
    : [...draft.value.tags, tag]
}
function addMaterial() {
  draft.value[activeSection.value] =
    `${draft.value[activeSection.value] || ''}\n:::material\n材料内容\n:::\n`
}
function insertImage(asset) {
  draft.value[activeSection.value] =
    `${draft.value[activeSection.value] || ''}\n![](${asset.url})\n`
}
function removeImage(asset) {
  for (const section of ['content', 'answer', 'solution'])
    draft.value[section] = (draft.value[section] || '').replace(
      /!\[[^\]\n]*\]\(([^)\n]+)\)/g,
      (match, ref) => ([asset.url, asset.altText].includes(ref) ? '' : match),
    )
  draft.value.assets = draft.value.assets.filter((a) => a.id !== asset.id)
}
async function selectFiles(files) {
  await run(async () => {
    const plan = await prepareImport([...files])
    importEntries.value = plan.entries
    groups.value = plan.groups
    batchId.value = ''
    importPage.value = 1
    batchTitle.value = `题目导入 ${new Date().toLocaleString('zh-CN')}`
    for (const group of groups.value) {
      const matching = papers.value.find((p) => p.title === group.title)
      if (matching) group.paperId = matching.id
    }
    message.value = `识别 ${plan.entries.length} 道题、${plan.groups.length} 个目录。请确认每个目录所属试卷。`
  })
}
async function startImport() {
  if (importing.value || busy.value) return
  if (groups.value.some((g) => !g.confirmed || (!g.paperId && !g.title.trim()))) {
    message.value = '请填写并确认每个目录的试卷归属，完整名称应包含年份和文理科'
    return
  }
  importing.value = true
  stopImport.value = false
  try {
    if (!batchId.value) batchId.value = (await api.post('/batches', { title: batchTitle.value })).id
    for (const group of groups.value)
      if (!group.paperId) group.paperId = (await api.post('/papers', { title: group.title })).id
    papers.value = await api.get('/papers')
    for (const entry of importEntries.value) {
      if (stopImport.value) break
      if (!['READY', 'FAILED'].includes(entry.result)) continue
      try {
        const group = groups.value.find((g) => g.folder === entry.folder)
        const result = await api.importFile(batchId.value, group.paperId, entry)
        Object.assign(entry, result)
      } catch (error) {
        entry.result = 'FAILED'
        entry.message = error.message
      }
    }
    await refresh()
    message.value = stopImport.value
      ? '已暂停。已上传的草稿保存在服务器；可继续导入。'
      : '本批文件已处理，请查看逐题结果并开始复核。'
  } catch (error) {
    message.value = error.message
  } finally {
    importing.value = false
  }
}
async function loadBatches() {
  await run(async () => {
    batches.value = await api.get('/batches')
  })
}
async function loadPublished() {
  await run(refreshPublished)
}
async function refreshPublished() {
  deleteSelected.value = []
  const data = await apiRequestPublished()
  const lastPage = Math.max(1, Math.ceil(data.pagination.total / 40))
  if (publishedPage.value > lastPage) {
    publishedPage.value = lastPage
    return refreshPublished()
  }
  published.value = data.items
  publishedTotal.value = data.pagination.total
}
async function apiRequestPublished() {
  return apiRequest(
    `/api/v1/admin/problems?${new URLSearchParams({ keyword: keyword.value, page: publishedPage.value, pageSize: 40 })}`,
  )
}
async function editFeedback(task) {
  await editPublished(task.number)
  if (item.value?.problem_number === task.number) feedbackTask.value = task
}
async function editPublished(number) {
  if (!discardAllowed()) return
  feedbackTask.value = null
  await run(async () => {
    const value = await api.post(`/published/${encodeURIComponent(number)}`)
    await openInternal(value.id)
    editing.value = true
    tab.value = 'queue'
    await refresh()
  })
}
function exportResults() {
  const content = JSON.stringify(
    importEntries.value.map(({ path, result, message, warnings, itemId }) => ({
      path,
      result,
      message,
      warnings,
      itemId,
    })),
    null,
    2,
  )
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = '导入结果.json'
  a.click()
  URL.revokeObjectURL(url)
}
function beforeUnload(event) {
  if (dirty.value || importing.value || publishing.value || publishFailure.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
function shortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && item.value) {
    event.preventDefault()
    void save(event.shiftKey)
  }
}
watch(
  draft,
  () => {
    clearTimeout(recoveryTimer)
    if (!dirty.value) return
    const key = recoveryKey(),
      version = item.value.version,
      document = clone(draft.value)
    recoveryTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ version, document, savedAt: new Date().toISOString() }),
        )
      } catch {
        message.value = '本机草稿空间不足，请及时保存到服务器'
      }
    }, 500)
  },
  { deep: true },
)
onBeforeRouteLeave(
  () =>
    !publishing.value &&
    (!publishFailure.value || window.confirm('有一道题的审核结果尚未确认，仍要离开吗？')) &&
    discardAllowed() &&
    (!importing.value ||
      window.confirm('离开会停止尚未上传的文件，已导入草稿仍会保留。继续离开？')),
)
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('keydown', shortcut)
  await run(async () => {
    me.value = await api.get('/me')
    papers.value = await api.get('/papers')
    await refresh()
  })
  leaseTimer = setInterval(
    () => {
      if (item.value && tab.value === 'queue' && !busy.value)
        api.post(`/items/${item.value.id}/lease`).catch((e) => {
          message.value = e.message
        })
    },
    5 * 60 * 1000,
  )
})
onBeforeUnmount(() => {
  disposed = true
  clearPrepared()
  stopImport.value = true
  clearInterval(leaseTimer)
  void releaseCurrent()
  clearTimeout(recoveryTimer)
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('keydown', shortcut)
})
watch([() => item.value?.id, () => queue.value.items, tab, feedbackTask], prepareNext)
watch([status, paperId, keyword, issue], () => {
  clearPrepared()
  void prepareNext()
})
</script>

<template>
  <section
    class="editorial-workbench"
    :class="{ 'is-reviewing': tab === 'queue' }"
    aria-label="题目导入与复核工作台"
  >
    <header class="editorial-header">
      <div>
        <h2>题目工作台</h2>
      </div>
      <span>{{
        { EDITOR: '录入人员', REVIEWER: '复核人员', MANAGER: '负责人' }[me?.permission]
      }}</span>
    </header>
    <nav class="editorial-tabs" aria-label="题目管理功能">
      <button
        :aria-pressed="tab === 'queue' && status === 'PENDING'"
        @click="changeQueue('PENDING')"
      >
        初审
      </button>
      <button
        :aria-pressed="tab === 'queue' && status === 'CHANGES'"
        @click="changeQueue('CHANGES')"
      >
        待修改
      </button>
      <button
        :aria-pressed="tab === 'published'"
        @click="
          () => {
            tab = 'published'
            loadPublished()
          }
        "
      >
        已发布
      </button>
      <button :aria-pressed="tab === 'feedback'" @click="tab = 'feedback'">用户反馈</button>
      <button :aria-pressed="tab === 'import'" @click="tab = 'import'">批量导入</button>
      <button :aria-expanded="settingsOpen" @click="settingsOpen = !settingsOpen">更多</button>
      <template v-if="settingsOpen">
        <button v-if="me?.permission === 'MANAGER'" @click="tab = 'trash'">回收站</button>
        <button
          :aria-pressed="tab === 'history'"
          @click="
            () => {
              tab = 'history'
              loadBatches()
            }
          "
        >
          导入记录
        </button>
        <button
          v-if="me?.permission === 'MANAGER'"
          :aria-pressed="tab === 'members'"
          @click="
            () => {
              tab = 'members'
              run(async () => (members = await api.get('/members')))
            }
          "
        >
          协作权限
        </button>
        <button
          v-if="me?.permission === 'MANAGER'"
          :aria-pressed="tab === 'curriculum'"
          @click="tab = 'curriculum'"
        >
          学期预设
        </button>
      </template>
    </nav>
    <ProblemRecycleBin v-if="tab === 'trash' && me?.permission === 'MANAGER'" />
    <CurriculumSettings v-if="tab === 'curriculum' && me?.permission === 'MANAGER'" />
    <div class="editorial-save-status" role="status" :class="{ 'has-error': publishFailure }">
      <span :title="publishFailure ? publishStatus : message || publishStatus">{{
        publishFailure ? publishStatus : message || publishStatus
      }}</span>
      <button v-if="publishFailure" :disabled="busy" @click="reopenFailed">返回失败题目重试</button>
    </div>
    <div
      v-if="deleteMode && me?.permission === 'MANAGER'"
      class="editorial-delete-toolbar"
      role="group"
      aria-label="批量删除题目"
    >
      <label
        ><input
          type="checkbox"
          :disabled="busy || !deletionEntries.length"
          :checked="deletionEntries.length > 0 && deleteSelected.length === deletionEntries.length"
          :indeterminate="
            deleteSelected.length > 0 && deleteSelected.length < deletionEntries.length
          "
          @change="deleteSelected = $event.target.checked ? deletionEntries.map((e) => e.id) : []"
        />选择当前页</label
      >
      <span>已选 {{ deleteSelected.length }} 题</span>
      <button
        class="editorial-delete-button"
        :disabled="busy || !deleteSelected.length"
        @click="deleteSelection"
      >
        删除所选
      </button>
      <button
        :disabled="busy"
        @click="
          () => {
            deleteMode = false
            deleteSelected = []
          }
        "
      >
        取消选择
      </button>
      <small>仅删除所选题目，可从“更多 → 回收站”恢复</small>
    </div>

    <div v-show="tab === 'import'" class="editorial-import">
      <h3>按目录导入题目和配图</h3>
      <p><a href="/docs/TAG与审核流程.md" download>下载 TAG 与审核流程说明</a></p>
      <p>
        <a href="/docs/题目上传规则1.4.md" download>下载上传规则1.4（Markdown）</a> ·
        <a href="/docs/题目上传规则1.4.docx" download>Word版规则</a> ·
        <a href="/docs/题目模板1.4.md" download>下载题目模板</a>
      </p>
      <p>
        支持规则1.4、1.2及普通
        Markdown。请选择包含图片的试卷目录；不同试卷中的同名文件会分别处理。导入后进入草稿，不直接公开。
      </p>
      <div class="editorial-actions">
        <label class="editorial-file-button"
          >选择文件夹<input
            type="file"
            webkitdirectory
            multiple
            :disabled="importing || busy"
            @change="
              ($event) => {
                selectFiles($event.target.files)
                $event.target.value = ''
              }
            "
        /></label>
        <label class="editorial-file-button"
          >选择 MD 和图片<input
            type="file"
            accept=".md,.png,.jpg,.jpeg,.gif,.webp"
            multiple
            :disabled="importing || busy"
            @change="
              ($event) => {
                selectFiles($event.target.files)
                $event.target.value = ''
              }
            "
        /></label>
      </div>

      <div
        @dragover.prevent
        @drop.prevent="selectFiles($event.dataTransfer.files)"
        class="editorial-drop"
      >
        也可将同一试卷的 MD 与图片拖到这里；批量目录请用“选择文件夹”。
      </div>
      <template v-if="importEntries.length">
        <label
          >批次名称<input v-model="batchTitle" :disabled="importing || !!batchId" maxlength="255"
        /></label>
        <details open>
          <summary>确认 {{ groups.length }} 个目录的试卷归属</summary>
          <div v-for="group in groups" :key="group.folder" class="editorial-paper-row">
            <span>{{ group.folder || '所选文件（无目录）' }}</span>
            <select
              v-model="group.paperId"
              :disabled="importing || !!batchId"
              @change="group.confirmed = false"
            >
              <option value="">创建新试卷</option>
              <option v-for="paper in papers" :key="paper.id" :value="paper.id">
                {{ paper.title }}
              </option>
            </select>
            <input
              v-if="!group.paperId"
              v-model="group.title"
              aria-label="试卷完整名称"
              placeholder="例如：2000年上海卷文科数学"
              :disabled="importing || !!batchId"
              @input="group.confirmed = false"
            />
            <label
              ><input
                type="checkbox"
                v-model="group.confirmed"
                :disabled="importing"
              />归属正确</label
            >
          </div>
        </details>
        <div class="editorial-actions">
          <button :disabled="importing || busy" @click="startImport">
            {{ batchId ? '继续 / 重试失败项' : '确认导入草稿' }}</button
          ><button v-if="importing" @click="stopImport = true">处理完当前题后暂停</button
          ><button @click="exportResults">下载结果</button
          ><span>{{ completedImports }} / {{ importEntries.length }}</span>
        </div>
        <progress :value="completedImports" :max="importEntries.length" />
        <div class="editorial-table-wrap">
          <table>
            <thead>
              <tr>
                <th>文件</th>
                <th>配图</th>
                <th>结果</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in visibleImports" :key="entry.path">
                <td>
                  {{ entry.path
                  }}<small v-for="warning in entry.warnings" :key="warning">{{ warning }}</small>
                </td>
                <td>{{ entry.images.length }}</td>
                <td>
                  {{ statusLabels[entry.result] }}<small>{{ entry.message }}</small>
                </td>
                <td>
                  <button @click="run(async () => (importPreview = await entry.file.text()))">
                    原文件</button
                  ><button v-if="entry.itemId" @click="open(entry.itemId)">打开草稿</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="editorial-actions">
          <button :disabled="importPage <= 1" @click="importPage--">上一页</button
          ><span>第 {{ importPage }} 页</span
          ><button :disabled="importPage * 40 >= importEntries.length" @click="importPage++">
            下一页
          </button>
        </div>
        <details v-if="importPreview" open>
          <summary>原始文件</summary>
          <pre>{{ importPreview }}</pre>
        </details>
      </template>
    </div>

    <div v-show="tab === 'queue'" class="editorial-queue-panel">
      <form
        class="editorial-filters"
        @submit.prevent="
          () => {
            queue.page = 1
            run(refresh)
          }
        "
      >
        <input
          v-model="keyword"
          aria-label="搜索题目"
          placeholder="题目、原始 ID、平台题号或试卷"
        />
        <select v-if="status === 'CHANGES'" v-model="issue" aria-label="问题类型">
          <option value="">全部问题类型</option>
          <option v-for="v in ['答案', '解析', '图片', '排版', '标签', '其他']" :key="v">
            {{ v }}
          </option>
        </select>
        <select v-model="paperId" aria-label="试卷">
          <option value="">全部试卷</option>
          <option v-for="paper in papers" :key="paper.id" :value="paper.id">
            {{ paper.title }}
          </option>
        </select>
        <button
          type="button"
          :aria-expanded="directoryOpen"
          @click="directoryOpen = !directoryOpen"
        >
          目录 · {{ queue.total }} 题
        </button>
        <button :disabled="busy">筛选</button
        ><button type="button" :disabled="busy" @click="newItem">手动录题</button>
        <button
          v-if="status === 'PENDING' && me?.permission === 'MANAGER' && !deleteMode"
          type="button"
          :disabled="busy || !queue.items.length"
          @click="startDeletion"
        >
          批量删除
        </button>
      </form>
      <div
        class="editorial-layout"
        :class="{ 'has-directory': directoryOpen }"
        :aria-busy="switching"
      >
        <div v-if="switching" class="editorial-switching" role="status">正在准备下一题…</div>
        <aside v-if="directoryOpen" class="editorial-queue">
          <p>共 {{ queue.total }} 题</p>
          <div v-for="entry in queue.items" :key="entry.id" class="editorial-queue-row">
            <input
              v-if="deleteMode"
              v-model="deleteSelected"
              type="checkbox"
              :value="entry.id"
              :disabled="busy"
              :aria-label="`选择初审题目 ${entry.title}`"
            />
            <button
              :aria-current="entry.id === item?.id ? 'true' : undefined"
              :disabled="busy"
              @click="open(entry.id)"
            >
              <strong>{{
                entry.original_number === '0'
                  ? entry.title
                  : `T${entry.original_number} · ${entry.title}`
              }}</strong
              ><small>{{ entry.paper_title }}</small
              ><small
                >{{ statusLabels[entry.status]
                }}<template v-if="entry.issue_type || entry.claimed_name">
                  · {{ entry.issue_type || `${entry.claimed_name} 处理中` }}</template
                ></small
              >
            </button>
          </div>
          <div class="editorial-actions">
            <button
              :disabled="queue.page <= 1 || busy"
              @click="
                () => {
                  queue.page--
                  run(refresh)
                }
              "
            >
              上页</button
            ><span>{{ queue.page }}</span
            ><button
              :disabled="queue.page * 40 >= queue.total || busy"
              @click="
                () => {
                  queue.page++
                  run(refresh)
                }
              "
            >
              下页
            </button>
          </div>
        </aside>
        <div v-if="!item" class="editorial-empty">
          <button v-if="queue.items.length" class="editorial-primary" @click="startReview">
            开始 / 继续审核
          </button>
          <p>{{ queue.items.length ? '从上次位置或本页第一题继续' : '当前分区没有待处理题目' }}</p>
        </div>
        <div v-else class="editorial-edit-area" :inert="switching" @paste="paste">
          <header class="editorial-item-header">
            <strong>{{ item.original_id || '新题目' }}</strong
            ><span>{{ statusLabels[item.status] }}{{ dirty ? ' · 未保存' : '' }}</span
            ><span v-if="item.problem_number">平台题号 {{ item.problem_number }}</span>
          </header>
          <div class="editorial-edit-scroll">
            <aside v-if="feedbackTask" class="editorial-feedback-note">
              <strong>本次反馈</strong>
              <p>{{ feedbackTask.summary }}</p>
            </aside>
            <p v-if="item.status === 'CHANGES'" class="editorial-message">
              {{ item.history?.find((h) => h.action === 'RETURN')?.note || '请检查并修改题目' }}
            </p>
            <aside v-if="recovery" class="editorial-message">
              发现本机未提交草稿（基于版本 {{ recovery.version }}）。<button
                @click="
                  () => {
                    draft = clone(recovery.document)
                    recovery = null
                  }
                "
              >
                恢复到编辑区</button
              ><button @click="forgetRecovery">忽略</button>
            </aside>
            <aside v-if="conflict" class="editorial-message">
              服务器已有版本 {{ conflict.version }}，本地修改已保留。<button
                @click="historyDocument = conflict.document"
              >
                对比服务器内容</button
              ><button @click="loadConflict">加载服务器版本</button>
            </aside>
            <p v-if="formulaWarnings.length" class="editorial-message">
              检测到公式渲染错误：{{
                formulaWarnings
                  .map((s) => ({ content: '题干', answer: '答案', solution: '解析' })[s])
                  .join('、')
              }}。请查看预览并修正 LaTeX。
            </p>
            <div class="editorial-columns" :class="{ 'is-editing': editing }">
              <div class="editorial-preview">
                <div class="editorial-preview-tools">
                  <span>核对题干、答案与解析</span
                  ><button @click="editing = !editing">
                    {{ editing ? '收起编辑' : '编辑题目' }}
                  </button>
                </div>
                <h4>{{ draft.title }}</h4>
                <section v-for="section in ['content', 'answer', 'solution']" :key="section">
                  <h4>{{ { content: '题干', answer: '答案', solution: '解析' }[section] }}</h4>
                  <MathText :text="previewText(section)" />
                  <figure
                    v-for="asset in draft.assets.filter(
                      (a) => a.section === section && !previewText(section).includes(`](${a.url})`),
                    )"
                    :key="asset.id"
                  >
                    <a :href="asset.url" target="_blank" rel="noopener"
                      ><img :src="asset.url" :alt="asset.altText"
                    /></a>
                    <figcaption>{{ asset.altText }}</figcaption>
                  </figure>
                </section>
              </div>
              <fieldset v-if="editing" class="editorial-form" :disabled="busy">
                <div class="editorial-actions">
                  <button
                    v-for="t in [
                      { key: 'content', label: '正文' },
                      { key: 'metadata', label: '题目信息' },
                      { key: 'assets', label: '配图' },
                    ]"
                    :key="t.key"
                    type="button"
                    :aria-pressed="editorTab === t.key"
                    @click="editorTab = t.key"
                  >
                    {{ t.label }}
                  </button>
                </div>
                <div v-show="editorTab === 'metadata'" class="editorial-form-section">
                  <CurriculumEditor
                    v-model="draft.curriculum"
                    :suggestions="item.curriculumSuggestions || []"
                  />

                  <label>标题<input v-model="draft.title" maxlength="255" /></label>
                  <label
                    >题号来源类别<select v-model="sourceCategory">
                      <option value="">按来源识别（已有题目保留原类别）</option>
                      <option value="G">G · 高考</option>
                      <option value="E">E · 其他正式考试</option>
                      <option value="T">T · 课本</option>
                      <option value="N">N · 其他</option>
                    </select></label
                  >
                  <div class="editorial-fields">
                    <label
                      >年份<input
                        type="number"
                        v-model.number="draft.year"
                        min="0"
                        max="9999" /></label
                    ><label
                      >来源<input
                        v-model="draft.source"
                        list="editorial-sources"
                        maxlength="100" /><datalist id="editorial-sources">
                        <option
                          v-for="source in props.sources"
                          :key="source.value"
                          :value="source.label"
                        /></datalist
                    ></label>
                  </div>
                  <div class="editorial-fields">
                    <label
                      >题型<select v-model="draft.type">
                        <option value="">请选择</option>
                        <option v-for="type in typeOptions" :key="type.value" :value="type.value">
                          {{ type.label }}
                        </option>
                      </select></label
                    ><label
                      >难度<select v-model="draft.level">
                        <option value="">请选择</option>
                        <option
                          v-for="(level, index) in DIFFICULTY_LEVELS"
                          :key="level"
                          :value="level"
                        >
                          D{{ index + 1 }} · {{ level.toUpperCase() }}
                        </option>
                      </select></label
                    >
                  </div>
                  <label
                    >难度模板校验<select v-model="templateId">
                      <option value="">不使用模板（手动复核）</option>
                      <option
                        v-for="template in DIFFICULTY_TEMPLATES"
                        :key="template.id"
                        :value="template.id"
                      >
                        {{ template.label }}
                      </option>
                    </select></label
                  >
                  <p v-if="difficultySuggestion">
                    按原卷题号建议 {{ difficultySuggestion.label }} ·
                    {{ difficultySuggestion.code }}
                    <button
                      type="button"
                      :disabled="difficultySuggestion.code === draft.level"
                      @click="draft.level = difficultySuggestion.code"
                    >
                      采用建议
                    </button>
                  </p>
                  <fieldset class="editorial-tag-list">
                    <legend>知识标签</legend>
                    <label v-for="tag in [...new Set([...props.tags, ...draft.tags])]" :key="tag"
                      ><input
                        type="checkbox"
                        :checked="draft.tags.includes(tag)"
                        @change="toggleTag(tag)"
                      />{{ tag }}</label
                    >
                  </fieldset>
                  <label v-if="draft.originalMetadata?.unmapped_tags"
                    ><input
                      type="checkbox"
                      @change="delete draft.originalMetadata.unmapped_tags"
                    />已整理无法映射的旧标签：{{ draft.originalMetadata.unmapped_tags }}</label
                  >
                </div>
                <div v-show="editorTab === 'content'" class="editorial-form-section">
                  <div class="editorial-actions">
                    <button
                      v-for="section in ['content', 'answer', 'solution']"
                      :key="section"
                      type="button"
                      :aria-pressed="activeSection === section"
                      @click="activeSection = section"
                    >
                      {{ { content: '题干', answer: '答案', solution: '解析' }[section] }}</button
                    ><button type="button" @click="addMaterial">插入材料段落</button>
                  </div>
                  <label
                    >编辑 {{ { content: '题干', answer: '答案', solution: '解析' }[activeSection]
                    }}<textarea v-model="draft[activeSection]" rows="14" />
                  </label>
                </div>
                <div v-show="editorTab === 'assets'" class="editorial-form-section">
                  <div
                    class="editorial-drop"
                    @dragover.prevent
                    @drop.prevent="upload($event.dataTransfer.files)"
                  >
                    <label
                      >添加图片<input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        multiple
                        @change="
                          ($event) => {
                            upload($event.target.files)
                            $event.target.value = ''
                          }
                        " /></label
                    ><small>可拖入或粘贴截图，图片添加到当前编辑段落。</small>
                  </div>
                  <div
                    v-for="(asset, index) in draft.assets"
                    :key="asset.id"
                    class="editorial-asset"
                  >
                    <img :src="asset.url" :alt="asset.altText" /><input
                      v-model="asset.altText"
                      aria-label="图片说明或原引用名称"
                      maxlength="255"
                    /><select v-model="asset.section" aria-label="图片归属">
                      <option value="content">题干</option>
                      <option value="answer">答案</option>
                      <option value="solution">解析</option></select
                    ><button type="button" @click="insertImage(asset)">插入正文位置</button
                    ><button type="button" @click="moveImage(index, -1)">上移</button
                    ><button type="button" @click="moveImage(index, 1)">下移</button
                    ><button type="button" @click="removeImage(asset)">移除</button>
                  </div>
                  <details v-if="draft.imageReferences.length">
                    <summary>原文件配图引用（{{ draft.imageReferences.length }}）</summary>
                    <p v-for="reference in draft.imageReferences" :key="reference">
                      {{ reference }} ·
                      {{ draft.assets.some((a) => a.altText === reference) ? '已关联' : '待补图' }}
                      <button type="button" @click="removeReference(reference)">不再需要</button>
                    </p>
                  </details>
                  <label
                    >复核备注 / 修改原因<textarea
                      v-model="note"
                      rows="2"
                      placeholder="例如：已对照原卷；修正分母；配图待查"
                    />
                  </label>
                </div>
              </fieldset>
            </div>
            <details v-if="editing">
              <summary>修改历史与原始信息</summary>
              <p v-for="entry in item.history" :key="entry.id">
                v{{ entry.version }} · {{ entry.action }} · {{ entry.username }} ·
                {{ entry.created_at }} · {{ entry.note }}
                <button
                  @click="
                    () => {
                      run(
                        async () =>
                          (historyDocument = await api.get(
                            `/items/${item.id}/history/${entry.id}`,
                          )),
                      )
                    }
                  "
                >
                  对比</button
                ><button :disabled="busy" @click="restoreHistory(entry.id)">恢复为草稿</button>
              </p>
              <pre>{{ draft.originalMetadata }}</pre>
              <details v-if="item.raw_markdown">
                <summary>导入时的原始 MD</summary>
                <pre>{{ item.raw_markdown }}</pre>
              </details>
            </details>
            <div v-if="historyDocument" class="editorial-comparison">
              <div>
                <h4>历史 / 服务器内容</h4>
                <pre>{{ JSON.stringify(historyDocument, null, 2) }}</pre>
              </div>
              <div>
                <h4>当前编辑内容</h4>
                <pre>{{ JSON.stringify(draft, null, 2) }}</pre>
              </div>
              <button @click="historyDocument = null">关闭对比</button>
            </div>
          </div>
          <div v-if="returnOpen" class="editorial-return-panel">
            <label
              >问题类型<select v-model="returnType">
                <option v-for="v in ['答案', '解析', '图片', '排版', '标签', '其他']" :key="v">
                  {{ v }}
                </option>
              </select></label
            >
            <label>备注（可选）<input v-model="note" placeholder="方便之后集中修改" /></label>
            <button :disabled="busy" @click="markChanges">确认并下一题</button
            ><button @click="returnOpen = false">取消</button>
          </div>
          <div class="editorial-save-bar">
            <button v-if="dirty || editing" :disabled="busy" @click="save()">保存草稿</button>
            <button
              v-if="(item.status === 'CHANGES' && !feedbackTask) || !isReviewer"
              class="editorial-primary"
              :disabled="busy"
              @click="action('SUBMIT')"
            >
              修改完成并下一题
            </button>
            <template v-else-if="item.status !== 'PUBLISHED' || dirty || feedbackTask">
              <button
                class="editorial-primary"
                :disabled="
                  busy ||
                  publishing ||
                  (publishFailure && publishFailure.id !== item.id) ||
                  (item.status === 'PUBLISHED' && !dirty)
                "
                @click="action('PUBLISH')"
              >
                {{ feedbackTask ? '发布修改并解决反馈' : '通过并下一题' }}
              </button>
              <button :disabled="busy" @click="returnOpen = !returnOpen">待修改并下一题</button>
            </template>
            <button :disabled="busy" @click="skipItem">跳过</button
            ><small v-if="dirty">Ctrl+S 保存</small>
          </div>
        </div>
      </div>
    </div>

    <FeedbackQueue
      v-if="tab === 'feedback'"
      :can-manage="me?.permission === 'MANAGER'"
      @edit="editFeedback"
    />
    <div v-if="tab === 'published'">
      <form
        class="editorial-filters"
        @submit.prevent="
          () => {
            publishedPage = 1
            loadPublished()
          }
        "
      >
        <input v-model="keyword" placeholder="搜索已发布题目" aria-label="搜索已发布题目" /><button>
          搜索
        </button>
        <button
          v-if="me?.permission === 'MANAGER' && !deleteMode"
          type="button"
          :disabled="busy || !published.length"
          @click="startDeletion"
        >
          批量删除
        </button>
      </form>
      <p>创建修订不会改变当前公开版本。</p>
      <div v-for="entry in published" :key="entry.id" class="editorial-paper-row">
        <input
          v-if="deleteMode"
          v-model="deleteSelected"
          type="checkbox"
          :value="entry.id"
          :disabled="busy"
          :aria-label="`选择已发布题目 ${entry.id}`"
        />
        <span>{{ entry.id }} · {{ entry.title }}</span>
        ><button :disabled="busy" @click="editPublished(entry.id)">校对 / 修改</button
        ><button
          v-if="me?.permission === 'MANAGER'"
          :disabled="busy"
          @click="deletePublished([entry])"
        >
          删除
        </button>
      </div>
      <div class="editorial-actions">
        <button
          :disabled="publishedPage <= 1 || busy"
          @click="
            () => {
              publishedPage--
              loadPublished()
            }
          "
        >
          上一页</button
        ><span>{{ publishedPage }} · 共 {{ publishedTotal }} 题</span
        ><button
          :disabled="publishedPage * 40 >= publishedTotal || busy"
          @click="
            () => {
              publishedPage++
              loadPublished()
            }
          "
        >
          下一页
        </button>
      </div>
    </div>
    <div v-if="tab === 'history'">
      <h3>导入批次</h3>
      <p>已上传结果保存在服务器。关闭网页前未上传的文件，需要重新选择；相同题目不会重复入库。</p>
      <div v-for="batch in batches" :key="batch.id" class="editorial-paper-row">
        <span>{{ batch.title }} · {{ batch.username }} · {{ batch.processed }} 项</span
        ><button @click="run(async () => (batchEntries = await api.get(`/batches/${batch.id}`)))">
          查看结果
        </button>
      </div>
      <div v-for="entry in batchEntries" :key="entry.path" class="editorial-paper-row">
        <span>{{ entry.path }} · {{ statusLabels[entry.result] }} · {{ entry.message }}</span
        ><button v-if="entry.item_id" @click="open(entry.item_id)">打开题目</button>
      </div>
    </div>
    <div v-if="tab === 'members'">
      <h3>管理员协作权限</h3>
      <p>录入人员负责草稿，复核人员可以发布，负责人可分配权限。现有管理员保留负责人权限。</p>
      <div v-for="member in members" :key="member.id" class="editorial-paper-row">
        <span>{{ member.username }} · {{ member.uid }}</span
        ><select v-model="member.permission" :disabled="member.id === me.id || busy">
          <option value="EDITOR">录入人员</option>
          <option value="REVIEWER">复核人员</option>
          <option value="MANAGER">负责人</option></select
        ><button
          :disabled="member.id === me.id || busy"
          @click="
            () => {
              run(async () => {
                await api.put(`/members/${member.id}`, { permission: member.permission })
                message = '权限已保存'
              })
            }
          "
        >
          保存权限
        </button>
      </div>
    </div>
  </section>
</template>
