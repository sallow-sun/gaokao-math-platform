<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MathText from '../components/content/MathText.vue'
import { listProblems } from '../services/problemService.js'
import ProblemsFilterPanel from '../components/problems/ProblemsFilterPanel.vue'
import { useProblemsQuery } from '../composables/useProblemsQuery.js'
import { useProblemsFilterPreferences } from '../composables/useProblemsFilterPreferences.js'
import {
  PROBLEMS_TYPE_CATALOG_OPTIONS,
  PROBLEMS_LEVEL_OPTIONS,
  PROBLEMS_YEAR_CATALOG_OPTIONS,
  PROBLEMS_SOURCE_CATALOG_OPTIONS,
  PROBLEMS_SORT_OPTIONS,
} from '../config/problems.js'
import {
  cleanPaperProblem,
  DRAFT_KEY,
  MM,
  PAPER_SIZES,
  paperQuestionHtml,
  questionBands,
  restorePaperDraft,
  safePageCut,
} from '../utils/paperLayout.js'
import '../assets/styles/paper-builder.css'

const compose = ref(null)
const searchText = ref('')
function searchProblems() {
  updateKeyword(searchText.value)
}
const title = ref('数学练习卷'),
  size = ref('a4'),
  items = ref([]),
  history = ref([])
const preview = ref(false),
  message = ref(''),
  storageMessage = ref('草稿仅保存在此浏览器')
const activeId = ref(''),
  drag = ref(null),
  dropIndex = ref(-1),
  workspace = ref(null),
  measure = ref(null)
const pages = ref([{ fragments: [] }]),
  layingOut = ref(false),
  layoutError = ref(''),
  printing = ref(false)
const available = ref([]),
  total = ref(0),
  currentPage = ref(1),
  loading = ref(false),
  loadError = ref('')
const query = useProblemsQuery('paper')
const { clearFilters, updateKeyword, updateYear, updateSource, updateType, updateLevel } = query
const filters = computed(() => ({
  keyword: query.keyword.value,
  types: query.questionTypes.value,
  tags: query.tags.value,
  levels: query.levels.value,
  years: query.years.value,
  sources: query.sources.value,
  chapters: query.chapters.value,
  learned: query.learned.value,
  learning: query.learning.value,
}))
const { filterMode, pinnedFilters, setFilterMode, setFilterPinned } = useProblemsFilterPreferences()
const visibleYearOptions = computed(() =>
  PROBLEMS_YEAR_CATALOG_OPTIONS.filter(
    (o) => !o.value || pinnedFilters.value.year.includes(o.value),
  ),
)
const visibleSourceOptions = computed(() =>
  PROBLEMS_SOURCE_CATALOG_OPTIONS.filter(
    (o) => !o.value || pinnedFilters.value.source.includes(o.value),
  ),
)
const visibleTypeOptions = computed(() =>
  PROBLEMS_TYPE_CATALOG_OPTIONS.filter(
    (o) => !o.value || pinnedFilters.value.type.includes(o.value),
  ),
)
function updateFilterMode(mode) {
  setFilterMode(mode)
  if (mode === 'single') query.collapseFiltersToSingle()
}
const sort = ref('newest'),
  seed = ref(crypto.randomUUID())
const expandedSources = ref(new Set())
function toggleSource(id) {
  const expanded = new Set(expandedSources.value)
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
  expandedSources.value = expanded
}
watch(
  () => filters.value.keyword,
  (value) => {
    searchText.value = value
  },
  { immediate: true },
)
const narrowScreen = window.matchMedia('(max-width: 980px)')
const filterOpen = ref(!narrowScreen.matches),
  zoom = ref(0.8),
  autoFit = ref(true)
const selectedIds = computed(() => new Set(items.value.map((i) => i.problem.id)))
function adaptFilters(event) {
  filterOpen.value = !event.matches
}
const sheet = computed(() => PAPER_SIZES[size.value])
const sheetStyle = computed(() => ({
  '--paper-width': `${sheet.value.width}mm`,
  '--paper-height': `${sheet.value.height}mm`,
}))
const state = () => ({ version: 1, title: title.value, size: size.value, items: items.value })
let request,
  requestId = 0,
  searchTimer,
  layoutTimer,
  layoutId = 0,
  resizeObserver,
  saveTimer,
  scrollFrame,
  lastDragY = 0
let disposed = false

function checkpoint() {
  history.value = [...history.value.slice(-19), JSON.stringify(state())]
}
function undo() {
  const previous = history.value.at(-1)
  if (!previous) return
  const restored = restorePaperDraft(previous)
  history.value = history.value.slice(0, -1)
  title.value = restored.title
  size.value = restored.size
  items.value = restored.items
  message.value = '已撤销上一步'
}
function fitWidth() {
  autoFit.value = true
  fit()
}
function setZoom(event) {
  autoFit.value = false
  zoom.value = Number(event.target.value) / 100
}
async function load(page = 1) {
  clearTimeout(searchTimer)
  request?.abort()
  request = new AbortController()
  const id = ++requestId
  loading.value = true
  loadError.value = ''
  available.value = []
  try {
    const result = await listProblems(
      { ...filters.value, sort: sort.value, seed: seed.value, page, pageSize: 12 },
      { signal: request.signal },
    )
    if (id !== requestId || disposed) return
    available.value = result.items
    total.value = result.pagination.total
    currentPage.value = page
  } catch (e) {
    if (id === requestId && e.name !== 'AbortError')
      loadError.value = e.message || '题库读取失败，请重试'
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch(
  [filters, sort, seed],
  () => {
    request?.abort()
    requestId++
    loading.value = true
    available.value = []
    total.value = 0
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => load(), 250)
  },
  { deep: true },
)
function shuffle() {
  sort.value = 'random'
  seed.value = crypto.randomUUID()
}
function add(problem, index = items.value.length) {
  if (selectedIds.value.has(problem.id)) {
    locate(problem.id)
    return
  }
  if (items.value.length >= 100) {
    message.value = '一份试卷最多添加 100 题'
    return
  }
  checkpoint()
  items.value.splice(index, 0, {
    problem: cleanPaperProblem(problem),
    space: 0,
    breakBefore: false,
  })
  activeId.value = problem.id
  message.value = `已加入第 ${index + 1} 题`
}
function remove(index) {
  checkpoint()
  items.value.splice(index, 1)
  message.value = '已移除题目，可撤销'
}
function move(from, to) {
  if (to < 0 || to >= items.value.length || from === to) return
  checkpoint()
  const [item] = items.value.splice(from, 1)
  items.value.splice(to, 0, item)
}
function changeItem(index, field, value) {
  checkpoint()
  items.value[index][field] = value
}
function clearPaper() {
  if (items.value.length) {
    checkpoint()
    items.value = []
    message.value = '已清空试卷，可撤销'
  }
}
function locate(id) {
  activeId.value = id
  compose.value
    ?.querySelector(`[data-paper-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
let dragFromControl = false
function rememberDragOrigin(event) {
  dragFromControl = Boolean(event.target.closest('button:not(.paper-grip), input, select, a'))
}
function startDrag(event, problem, from = -1) {
  if (dragFromControl || preview.value || !problem) {
    event.preventDefault()
    return
  }
  window.getSelection()?.removeAllRanges()
  event.dataTransfer.setDragImage(event.currentTarget, 30, 25)
  drag.value = { problem, from }
  event.dataTransfer.effectAllowed = from < 0 ? 'copy' : 'move'
  event.dataTransfer.setData('text/plain', problem.id)
}
function endDrag() {
  drag.value = null
  dropIndex.value = -1
  cancelAnimationFrame(scrollFrame)
}
function scrollDrag() {
  if (!drag.value || !compose.value) return
  const box = compose.value.getBoundingClientRect()
  const delta = lastDragY < box.top + 65 ? -14 : lastDragY > box.bottom - 65 ? 14 : 0
  if (delta) compose.value.scrollTop += delta
  scrollFrame = requestAnimationFrame(scrollDrag)
}
function dragOver(event, index) {
  if (!drag.value) return
  event.preventDefault()
  lastDragY = event.clientY
  event.dataTransfer.dropEffect = drag.value.from < 0 ? 'copy' : 'move'
  dropIndex.value = index
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(scrollDrag)
}
function dragOverFragment(event, fragment) {
  const box = event.currentTarget.getBoundingClientRect()
  dragOver(event, fragment.index + (event.clientY > box.top + box.height / 2 ? 1 : 0))
}
function drop(event, index) {
  event.preventDefault()
  if (!drag.value) return
  const { problem, from } = drag.value
  if (from < 0) add(problem, index)
  else move(from, from < index ? index - 1 : index)
  endDrag()
}
function fit() {
  if (preview.value && autoFit.value && workspace.value)
    zoom.value = Math.min(
      1,
      Math.max(0.28, (workspace.value.clientWidth - 58) / (sheet.value.width * MM)),
    )
}
function queueLayout() {
  layoutId++
  layingOut.value = true
  clearTimeout(layoutTimer)
  layoutTimer = setTimeout(layout, 80)
}
async function layout() {
  const id = ++layoutId
  layingOut.value = true
  layoutError.value = ''
  await nextTick()
  await document.fonts.ready
  if (disposed || id !== layoutId || !measure.value) return
  const images = [...measure.value.querySelectorAll('img')]
  const loaded = await Promise.all(
    images.map(async (img) => {
      img.loading = 'eager'
      try {
        await Promise.race([
          img.decode(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ])
        return true
      } catch {
        return false
      }
    }),
  )
  if (disposed || id !== layoutId) return
  if (loaded.some((ok) => !ok))
    layoutError.value = '部分配图未加载，暂不能打印。请检查网络后重试排版。'
  measure.value.querySelectorAll('.paper-choices').forEach((el) => {
    el.style.setProperty('--choice-columns', '1')
    el.querySelectorAll('.paper-choice-content').forEach((choice) => {
      choice.style.maxWidth = ''
    })
    const widths = [...el.querySelectorAll('.paper-choice-content')].map(
      (choice) => choice.getBoundingClientRect().width,
    )
    const max = Math.max(...widths)
    el.style.setProperty(
      '--choice-columns',
      max <= (el.clientWidth - 36) / 4 ? '4' : max <= (el.clientWidth - 12) / 2 ? '2' : '1',
    )
    el.querySelectorAll('.paper-choice-content').forEach((choice) => {
      choice.style.maxWidth = '100%'
    })
  })
  measure.value.querySelectorAll('.katex').forEach((el) => {
    if (el.parentElement.closest('.katex')) return
    el.style.fontSize = ''
    const container =
      el.closest('.paper-choice') || el.closest('.math-question-body') || el.closest('.math-text')
    if (container && el.getBoundingClientRect().width > container.clientWidth)
      el.style.fontSize = `${container.clientWidth / el.getBoundingClientRect().width}em`
  })
  const capacity = (sheet.value.height - 40) * MM
  const headerHeight =
    measure.value.querySelector('.paper-heading').getBoundingClientRect().height + 18
  const result = [{ fragments: [], used: headerHeight }]
  const nextPage = () => {
    const p = { fragments: [], used: 0 }
    result.push(p)
    return p
  }
  const elements = [...measure.value.querySelectorAll('.paper-measure-question')]
  for (let index = 0; index < elements.length; index++) {
    const el = elements[index],
      item = items.value[index]
    const height = Math.ceil(el.getBoundingClientRect().height) + 1
    const html = el.innerHTML,
      bands = questionBands(el)
    let page = result.at(-1)
    if (
      (item.breakBefore || (height > capacity - page.used && height <= capacity)) &&
      page.used > 0
    )
      page = nextPage()
    let offset = 0
    while (offset < height) {
      let room = capacity - page.used
      if (room < 45) {
        page = nextPage()
        room = capacity
      }
      let end = safePageCut(bands, offset, room, height)
      if (end <= offset + 1) {
        if (page.used) {
          page = nextPage()
          continue
        }
        // A single unusually tall formula is kept whole and scaled to one page.
        const scale = Math.min(1, capacity / (height - offset))
        page.fragments.push({
          index,
          html,
          offset,
          height: (height - offset) * scale,
          scale,
          first: offset === 0,
        })
        page.used = capacity
        offset = height
      } else {
        page.fragments.push({
          index,
          html,
          offset,
          height: end - offset,
          scale: 1,
          first: offset === 0,
        })
        page.used += end - offset
        offset = end
        if (offset < height) page = nextPage()
      }
    }
  }
  pages.value = result
  layingOut.value = false
  fit()
}
function persist() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state()))
    storageMessage.value = '草稿已保存在此浏览器'
  } catch {
    storageMessage.value = '浏览器存储不可用，离开页面可能丢失草稿'
  }
}
watch(
  [items, title, size],
  () => {
    queueLayout()
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 250)
  },
  { deep: true },
)
watch(preview, () => nextTick(fit))
function finishPrint() {
  printing.value = false
  document.getElementById('paper-print-root')?.remove()
  document.getElementById('paper-print-page-rule')?.remove()
  document.body.classList.remove('is-printing-paper')
}
async function printPaper() {
  await layout()
  if (layoutError.value || layingOut.value || !items.value.length) return
  await nextTick()
  const root = document.createElement('div')
  root.id = 'paper-print-root'
  const style = document.createElement('style')
  style.id = 'paper-print-page-rule'
  style.textContent = `@page { size: ${sheet.value.width}mm ${sheet.value.height}mm; margin: 0; }`
  workspace.value.querySelectorAll('.paper-sheet').forEach((el) => {
    const clone = el.cloneNode(true)
    clone.querySelectorAll('.paper-item-tools,.paper-drop-line').forEach((tool) => tool.remove())
    clone.removeAttribute('id')
    clone.style.zoom = '1'
    root.append(clone)
  })
  document.head.append(style)
  document.body.append(root)
  try {
    await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode()))
    printing.value = true
    document.body.classList.add('is-printing-paper')
    window.print()
  } catch {
    finishPrint()
    message.value = '打印准备失败，请检查配图后重试'
  }
}
function keydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault()
    if (items.value.length && !layingOut.value && !printing.value) printPaper()
  }
  if (event.key === 'Escape') {
    preview.value = false
    endDrag()
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === 'z' &&
    !event.target.closest('input,textarea,select')
  ) {
    event.preventDefault()
    undo()
  }
}
onMounted(async () => {
  narrowScreen.addEventListener('change', adaptFilters)
  try {
    const saved = restorePaperDraft(localStorage.getItem(DRAFT_KEY))
    if (saved) {
      title.value = saved.title
      size.value = saved.size
      items.value = saved.items
      storageMessage.value = '已恢复此浏览器的草稿'
    }
  } catch {
    storageMessage.value = '未能读取旧草稿，当前可正常组卷'
  }
  resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(workspace.value)
  window.addEventListener('afterprint', finishPrint)
  window.addEventListener('keydown', keydown)
  load()
  queueLayout()
})
onBeforeUnmount(() => {
  narrowScreen.removeEventListener('change', adaptFilters)
  disposed = true
  request?.abort()
  resizeObserver?.disconnect()
  persist()
  clearTimeout(searchTimer)
  clearTimeout(layoutTimer)
  clearTimeout(saveTimer)
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('afterprint', finishPrint)
  window.removeEventListener('keydown', keydown)
  finishPrint()
})
</script>

<template>
  <main
    class="paper-builder"
    :class="{ 'is-preview': preview, 'is-dragging': drag, 'is-laying-out': layingOut }"
  >
    <div class="paper-workbench" :class="{ 'filters-hidden': !filterOpen }">
      <aside v-show="!preview && filterOpen" class="paper-filter-sidebar" aria-label="筛选条件">
        <div class="paper-filter-title">
          <h2>筛选条件</h2>
          <button class="paper-link" aria-label="收起筛选" @click="filterOpen = false">
            收起筛选 ‹
          </button>
        </div>
        <div class="paper-shared-filters">
          <ProblemsFilterPanel
            route-name="paper"
            :filter-mode="filterMode"
            :keyword="filters.keyword"
            :level="filters.levels"
            :level-options="PROBLEMS_LEVEL_OPTIONS"
            :question-type="filters.types"
            :source="filters.sources"
            :source-catalog-options="PROBLEMS_SOURCE_CATALOG_OPTIONS"
            :source-options="visibleSourceOptions"
            :source-pinned-values="pinnedFilters.source"
            :type-catalog-options="PROBLEMS_TYPE_CATALOG_OPTIONS"
            :type-options="visibleTypeOptions"
            :type-pinned-values="pinnedFilters.type"
            :year="filters.years"
            :year-catalog-options="PROBLEMS_YEAR_CATALOG_OPTIONS"
            :year-options="visibleYearOptions"
            :year-pinned-values="pinnedFilters.year"
            @search="updateKeyword"
            @clear="clearFilters"
            @filter-mode-change="updateFilterMode"
            @year-change="updateYear"
            @source-change="updateSource"
            @type-change="updateType"
            @level-change="updateLevel"
            @year-pin-change="setFilterPinned('year', $event.value, $event.pinned)"
            @source-pin-change="setFilterPinned('source', $event.value, $event.pinned)"
            @type-pin-change="setFilterPinned('type', $event.value, $event.pinned)"
          />
        </div>
      </aside>
      <section v-show="!preview" class="paper-bank" aria-label="选题题库">
        <div class="paper-bank-head">
          <h2>
            题库 <small>共 {{ total }} 道题</small>
          </h2>
          <button v-if="!filterOpen" class="paper-link" @click="filterOpen = true">展开筛选</button>
        </div>
        <form class="paper-search" role="search" @submit.prevent="searchProblems">
          <input
            v-model="searchText"
            type="search"
            aria-label="搜索题目"
            placeholder="搜索题号、来源或知识点…"
          /><button type="submit">搜索</button>
        </form>
        <div class="paper-sortbar">
          <span>{{ loading ? '正在筛选…' : '拖动题卡，或点击加入' }}</span
          ><select v-model="sort" aria-label="题目排序">
            <option value="newest">新题优先</option>
            <option value="random">随机排序</option>
            <option
              v-for="o in PROBLEMS_SORT_OPTIONS.filter((o) => o.value !== 'newest')"
              :key="o.value"
              :value="o.value"
            >
              {{ o.label }}
            </option></select
          ><button :disabled="loading" title="对全部筛选结果重新随机排序" @click="shuffle">
            ↻ 换一批
          </button>
        </div>
        <div class="paper-bank-results" :aria-busy="loading">
          <p v-if="loadError" class="paper-error" role="alert">
            {{ loadError }} <button @click="load()">重试</button>
          </p>
          <div v-else-if="loading" class="paper-result-placeholder">正在寻找合适的题目…</div>
          <div v-else-if="!available.length" class="paper-result-placeholder">
            没有符合条件的题目<br /><button class="paper-link" @click="clearFilters">
              调整或清除筛选条件
            </button>
          </div>
          <article
            v-for="problem in available"
            :key="problem.id"
            class="paper-source-card"
            :class="{ 'is-added': selectedIds.has(problem.id) }"
            :data-source-id="problem.id"
            draggable="true"
            @pointerdown="rememberDragOrigin"
            @dragstart="startDrag($event, problem)"
            @dragend="endDrag"
          >
            <header>
              <span class="paper-type-chip" :data-type="problem.type">{{ problem.typeLabel }}</span>
              <span v-for="tag in problem.tags?.slice(0, 2)" :key="tag" class="paper-tag-chip">{{
                tag
              }}</span>
              <span class="paper-grip" title="整张题卡均可拖动">⠿</span
              ><button
                v-if="selectedIds.has(problem.id)"
                class="paper-added"
                @click="locate(problem.id)"
              >
                ✓ 已加入 · {{ items.findIndex((i) => i.problem.id === problem.id) + 1 }}</button
              ><button
                v-else
                class="paper-add"
                :aria-label="`添加题目 ${problem.id}`"
                @click="add(problem)"
              >
                ＋ 加入
              </button>
            </header>
            <div
              class="paper-source-content"
              :class="{
                'is-collapsed':
                  !expandedSources.has(problem.id) &&
                  (problem.content.length > 350 || problem.content.split('\n').length > 7),
              }"
            >
              <MathText :text="problem.content" /><img
                v-for="asset in cleanPaperProblem(problem).assets.filter(
                  (a) => !problem.content.includes(`](${a.url})`),
                )"
                :key="asset.url"
                :src="asset.url"
                :alt="asset.altText"
                loading="lazy"
                draggable="false"
              />
            </div>
            <button
              v-if="problem.content.length > 350 || problem.content.split('\n').length > 7"
              class="paper-source-expand paper-link"
              :aria-expanded="expandedSources.has(problem.id)"
              @click="toggleSource(problem.id)"
            >
              {{ expandedSources.has(problem.id) ? '收起长题 ↑' : '展开完整题目 ↓' }}
            </button>
            <footer>
              <span>{{ problem.sourceText }}</span
              ><small>{{ problem.id }}</small>
            </footer>
          </article>
        </div>
        <nav class="paper-pagination" aria-label="题库翻页">
          <button :disabled="loading || currentPage <= 1" @click="load(currentPage - 1)">
            上一页</button
          ><span>{{ total ? currentPage : 0 }} / {{ Math.ceil(total / 12) || 0 }}</span
          ><button :disabled="loading || currentPage * 12 >= total" @click="load(currentPage + 1)">
            下一页
          </button>
        </nav>
      </section>
      <section class="paper-editor" aria-label="试卷工作区">
        <div class="paper-editor-head">
          <span class="paper-count"
            >已添加 <b>{{ items.length }}</b> 题 · {{ pages.length }} 页</span
          >
          <div class="paper-top-actions">
            <button :aria-pressed="preview" @click="preview = !preview">
              {{ preview ? '← 返回编辑' : '预览打印' }}</button
            ><button
              class="paper-primary"
              :disabled="!items.length || layingOut || !!layoutError || printing"
              @click="printPaper"
            >
              打印 / 存为 PDF
            </button>
          </div>
        </div>
        <div class="paper-document-options">
          <h2>{{ preview ? '打印预览' : '我的试卷' }}</h2>
          <span v-if="!preview">可直接拖拽调整顺序</span>
        </div>
        <div v-show="!preview" class="paper-title-field">
          <label for="paper-title">试卷名称</label
          ><input id="paper-title" v-model="title" maxlength="100" @focus="checkpoint" />
        </div>
        <div class="paper-view-toolbar">
          <select v-model="size" aria-label="纸张尺寸" @focus="checkpoint">
            <option value="a4">A4 纵向</option>
            <option value="16k">16 开 · 原卷尺寸</option></select
          ><template v-if="preview"
            ><button :aria-pressed="autoFit" @click="fitWidth">适合宽度</button
            ><select :value="Math.round(zoom * 100)" aria-label="预览缩放" @change="setZoom">
              <option :value="Math.round(zoom * 100)">{{ Math.round(zoom * 100) }}%</option>
              <option v-for="z in [50, 75, 100, 125]" :key="z" :value="z">{{ z }}%</option>
            </select></template
          ><span class="paper-save-state">{{ storageMessage }}</span>
        </div>
        <div class="paper-status" aria-live="polite">
          <span>{{
            message ||
            (preview
              ? '检查分页、公式与配图；打印时可保存为 PDF。'
              : '整张题卡均可拖动，题目顺序与打印保持一致。')
          }}</span
          ><span v-if="layingOut">正在排版…</span>
        </div>
        <div v-if="layoutError" class="paper-error" role="alert">
          {{ layoutError }} <button @click="queueLayout">重试排版</button>
        </div>
        <div
          v-show="!preview"
          ref="compose"
          class="paper-compose"
          @dragover="dragOver($event, items.length)"
          @drop="drop($event, items.length)"
        >
          <article
            v-for="(item, index) in items"
            :key="item.problem.id"
            class="paper-compose-card"
            :class="{
              'is-active': activeId === item.problem.id,
              'is-drop-target': dropIndex === index,
            }"
            :data-paper-id="item.problem.id"
            draggable="true"
            @pointerdown="rememberDragOrigin"
            @dragstart="startDrag($event, item.problem, index)"
            @dragend="endDrag"
            @click="activeId = item.problem.id"
            @dragover.stop="dragOverFragment($event, { index })"
            @drop.stop="drop($event, dropIndex < 0 ? index : dropIndex)"
          >
            <header>
              <span class="paper-type-chip" :data-type="item.problem.type">{{
                item.problem.typeLabel || '题目'
              }}</span
              ><span>第 {{ index + 1 }} 题</span><small v-if="item.breakBefore">另起一页</small>
            </header>
            <div
              class="paper-compose-question"
              v-html="paperQuestionHtml({ ...item, space: 0 }, index)"
            />
            <div class="paper-item-tools" @click.stop>
              <button class="paper-grip" title="拖动排序" :aria-label="`拖动第 ${index + 1} 题`">
                ⠿
              </button>
              <button :disabled="index === 0" title="上移" @click="move(index, index - 1)">↑</button
              ><button
                :disabled="index === items.length - 1"
                title="下移"
                @click="move(index, index + 1)"
              >
                ↓
              </button>
              <select
                :value="items[index].space"
                :aria-label="`第 ${index + 1} 题答题留白`"
                @change="changeItem(index, 'space', Number($event.target.value))"
              >
                <option :value="0">无留白</option>
                <option :value="20">留白 · 少</option>
                <option :value="40">留白 · 中</option>
                <option :value="60">留白 · 多</option>
              </select>
              <button
                :aria-pressed="items[index].breakBefore"
                title="从新页开始"
                @click="changeItem(index, 'breakBefore', !items[index].breakBefore)"
              >
                另起一页</button
              ><button :aria-label="`移除第 ${index + 1} 题`" @click="remove(index)">×</button>
            </div>
          </article>
          <div
            class="paper-empty"
            :class="{ 'is-drop-target': dropIndex === items.length }"
            @dragover.stop="dragOver($event, items.length)"
            @drop.stop="drop($event, items.length)"
          >
            <span class="paper-empty-icon">＋</span>
            <h3>{{ items.length ? '继续添加题目' : '拖拽题目到这里' }}</h3>
            <p>或点击题库中的「＋ 加入」</p>
          </div>
        </div>
        <div
          ref="workspace"
          v-show="preview"
          class="paper-canvas"
          @dragover="dragOver($event, items.length)"
          @drop="drop($event, items.length)"
        >
          <div
            v-for="(page, pageIndex) in pages"
            :key="pageIndex"
            class="paper-page-wrap"
            :style="{
              width: `${sheet.width * MM * zoom}px`,
              height: `${sheet.height * MM * zoom}px`,
            }"
          >
            <section
              class="paper-sheet"
              :style="{ ...sheetStyle, zoom }"
              :aria-label="`试卷第 ${pageIndex + 1} 页`"
            >
              <header v-if="pageIndex === 0" class="paper-heading">
                <p>{{ title || '数学练习卷' }}</p>
                <h2>数　学</h2>
                <div class="paper-candidate">姓名：____________　班级：____________</div>
                <div class="paper-instructions">
                  本试卷共 {{ pages.length }} 页，{{ items.length }} 小题。请认真审题，规范作答。
                </div>
              </header>
              <article
                v-for="(fragment, fi) in page.fragments"
                :key="`${fragment.index}:${fi}`"
                class="paper-fragment"
                :class="{
                  'is-active': activeId === items[fragment.index]?.problem.id,
                  'is-drop-target': dropIndex === fragment.index,
                }"
                :data-paper-id="items[fragment.index]?.problem.id"
                :style="{ height: `${fragment.height}px` }"
                @dragover.stop="dragOverFragment($event, fragment)"
                @drop.stop="drop($event, dropIndex < 0 ? fragment.index : dropIndex)"
              >
                <div v-if="drag && dropIndex === fragment.index" class="paper-drop-line">
                  插入为第 {{ fragment.index + 1 }} 题
                </div>
                <div class="paper-fragment-clip" :style="{ height: `${fragment.height}px` }">
                  <div
                    class="paper-question-content"
                    :style="{
                      transform: `scale(${fragment.scale}) translateY(-${fragment.offset}px)`,
                      transformOrigin: 'top left',
                    }"
                    v-html="fragment.html"
                  />
                </div>
              </article>
              <div
                v-if="drag && pageIndex === pages.length - 1 && dropIndex === items.length"
                class="paper-drop-line is-last"
              >
                追加为第 {{ items.length + 1 }} 题
              </div>
              <footer class="paper-page-footer">
                数学试题　第 {{ pageIndex + 1 }} 页（共 {{ pages.length }} 页）
              </footer>
            </section>
          </div>
        </div>

        <footer class="paper-workspace-footer">
          <div>
            <strong>共 {{ items.length }} 题</strong
            ><span>{{ PAPER_SIZES[size].label }} · {{ pages.length }} 页</span>
          </div>
          <div>
            <button :disabled="!history.length" @click="undo">↶ 撤销</button
            ><button :disabled="!items.length" @click="clearPaper">清空试卷</button
            ><button class="paper-primary" @click="persist">保存草稿</button>
          </div>
        </footer>
      </section>
    </div>
    <div ref="measure" class="paper-measure paper-sheet" :style="sheetStyle" aria-hidden="true">
      <header class="paper-heading">
        <p>{{ title || '数学练习卷' }}</p>
        <h2>数　学</h2>
        <div class="paper-candidate">姓名：____________　班级：____________</div>
        <div class="paper-instructions">
          本试卷共 {{ pages.length }} 页，{{ items.length }} 小题。请认真审题，规范作答。
        </div>
      </header>
      <div
        v-for="(item, index) in items"
        :key="item.problem.id"
        class="paper-measure-question paper-question-content"
        v-html="paperQuestionHtml(item, index)"
      />
    </div>
  </main>
</template>
