<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { apiRequest } from '../../services/apiClient.js'
import DocumentContentPreview from './DocumentContentPreview.vue'
import {
  allBands,
  groupBands,
  moveBoundary,
  numberBands,
  removeBoundary,
  splitHorizontal,
  splitVertical,
} from '../../utils/documentLayout.js'

const props = defineProps({ active: { type: Boolean, default: true } })
const emit = defineEmits(['import-files'])
const root = '/api/v1/admin/document-import'
const job = ref(null),
  jobs = ref([]),
  pageIndex = ref(0),
  selected = ref(''),
  mode = ref('select')
const dirty = ref(false),
  busy = ref(false),
  message = ref(''),
  health = ref(null),
  showSuggestions = ref(true)
const startNumber = ref(1),
  maxCalls = ref(1),
  batchSize = ref(3),
  online = ref(false),
  selectedQuestion = ref('')
const confirmed = ref(false),
  ocrScope = ref('all'),
  edits = ref({}),
  history = ref([]),
  svg = ref(null)
let drag = null,
  timer = null,
  disposed = false,
  polling = false
const types = ['未知', '单选题', '多选题', '填空题', '解答题']
const labels = {
  ready: '可编辑',
  rendering: '正在渲染',
  recognizing: '正在识别',
  failed: '处理失败',
  interrupted: '任务中断',
}
const page = computed(() => job.value?.pages[pageIndex.value])
const working = computed(() => ['rendering', 'recognizing'].includes(job.value?.status))
const parts = computed(() => (job.value ? allBands(job.value) : []))
const groups = computed(() => (job.value ? groupBands(job.value) : []))
const selection = computed(() => parts.value.find((p) => p.band.id === selected.value))
const result = computed(() => job.value?.results[selectedQuestion.value])
const editor = computed(() => edits.value[selectedQuestion.value] || result.value)
const unassigned = computed(
  () => parts.value.filter((p) => !p.band.skip && !p.band.question).length,
)
const requests = computed(() =>
  Math.ceil((ocrScope.value === 'one' ? 1 : groups.value.length) / batchSize.value),
)
const imageUrl = (name) => `${root}/jobs/${job.value.id}/image/${name}`
const api = (path, options) => apiRequest(root + path, options)

async function run(action) {
  if (busy.value) return
  busy.value = true
  try {
    await action()
  } catch (error) {
    message.value = error.message
  } finally {
    busy.value = false
  }
}
function changed() {
  dirty.value = true
  confirmed.value = false
}
function snapshot() {
  history.value.push(JSON.stringify(job.value.pages))
  if (history.value.length > 25) history.value.shift()
}
function undo() {
  if (!history.value.length) return
  job.value.pages = JSON.parse(history.value.pop())
  selected.value = ''
  changed()
}
function setJob(value) {
  job.value = value
  dirty.value = false
  edits.value = {}
  history.value = []
  confirmed.value = false
  pageIndex.value = Math.min(pageIndex.value, Math.max(0, value.pages.length - 1))
  if (!selectedQuestion.value || !value.results[selectedQuestion.value])
    selectedQuestion.value = Object.keys(value.results)[0] || ''
}
async function refreshJobs() {
  jobs.value = await api('/jobs')
}
async function open(id) {
  if (dirty.value && !window.confirm('有未保存的修改，放弃这些修改并打开任务？')) return
  await run(async () => {
    setJob(await api(`/jobs/${id}`))
    message.value = '任务已加载'
  })
}
async function upload(event, append = false) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    message.value = '单文件最多 10MB'
    return
  }
  if (dirty.value) {
    message.value = '请先保存当前修改'
    return
  }
  await run(async () => {
    const body = new FormData()
    body.append('file', file)
    setJob(await api(append ? `/jobs/${job.value.id}/append` : '/jobs', { method: 'POST', body }))
    message.value = '文件已上传，后台正在准备页面'
    await refreshJobs()
  })
}
async function save() {
  const value = await api(`/jobs/${job.value.id}`, {
    method: 'PUT',
    body: {
      version: job.value.version,
      pages: job.value.pages,
      metadata: job.value.metadata,
      edits: edits.value,
    },
  })
  setJob(value)
  message.value = '切分和内容已保存'
}
function point(event) {
  const box = svg.value.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(1000, ((event.clientX - box.left) / box.width) * 1000)),
    y: Math.max(0, Math.min(1000, ((event.clientY - box.top) / box.height) * 1000)),
  }
}
function clickBand(event, band, column) {
  if (working.value || busy.value) return
  const { x, y } = point(event)
  if (mode.value === 'horizontal' || mode.value === 'vertical') {
    snapshot()
    const success =
      mode.value === 'horizontal'
        ? splitHorizontal(page.value, column, y)
        : splitVertical(page.value, x)
    if (success) changed()
    else history.value.pop()
  } else {
    selected.value = band.id
    if (band.question) selectedQuestion.value = band.question
  }
}
function lineDown(event, boundary) {
  if (working.value || busy.value) return
  event.stopPropagation()
  snapshot()
  if (mode.value === 'delete') {
    removeBoundary(page.value, boundary)
    selected.value = ''
    changed()
    return
  }
  drag = boundary
  svg.value.setPointerCapture(event.pointerId)
}
function lineMove(event) {
  if (!drag) return
  const p = point(event)
  moveBoundary(page.value, drag, drag.axis === 'x' ? p.x : p.y)
  changed()
}
function lineUp() {
  drag = null
}
function applySuggestion(column, y) {
  if (working.value || busy.value) return
  snapshot()
  if (splitHorizontal(page.value, column, y)) changed()
  else history.value.pop()
}
function numberPage() {
  snapshot()
  numberBands(job.value, Number(startNumber.value), page.value.id)
  changed()
}
function editResult(field, value) {
  if (!edits.value[selectedQuestion.value])
    edits.value[selectedQuestion.value] = JSON.parse(JSON.stringify(result.value))
  edits.value[selectedQuestion.value][field] = value
  changed()
}
async function recognize() {
  if (!confirmed.value || dirty.value) {
    message.value = '请先保存，然后确认切分边界'
    return
  }
  await run(async () => {
    const body = {
      version: job.value.version,
      maxCalls: Number(maxCalls.value),
      batchSize: Number(batchSize.value),
      online: online.value,
    }
    if (ocrScope.value === 'one')
      body.questions = [selectedQuestion.value || selection.value?.band.question]
    const value = await api(`/jobs/${job.value.id}/recognize`, { method: 'POST', body })
    setJob(value)
    online.value = false
    message.value =
      value.status === 'recognizing' ? '识别任务已启动，可以稍后返回' : '全部命中缓存，没有调用 API'
  })
}
async function download(kind) {
  if (dirty.value) {
    message.value = '请先保存修改'
    return
  }
  await run(async () => {
    const response = await fetch(`${root}/jobs/${job.value.id}/${kind}`, { credentials: 'include' })
    if (!response.ok) throw new Error((await response.json()).error?.message || '下载失败')
    const url = URL.createObjectURL(await response.blob()),
      link = document.createElement('a')
    link.href = url
    link.download = `${job.value.metadata.title || '试卷'}-${kind}.zip`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  })
}
async function importDrafts() {
  if (dirty.value) {
    message.value = '请先保存修改'
    return
  }
  await run(async () => {
    const bundle = await api(`/jobs/${job.value.id}/bundle`)
    const files = bundle.map((entry) => {
      const bytes = Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0))
      const file = new File([bytes], entry.name, {
        type: entry.name.endsWith('.md') ? 'text/markdown' : 'image/png',
      })
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `${job.value.metadata.title.replaceAll('/', '_').replaceAll('\\', '_')}/${entry.name}`,
      })
      return file
    })
    emit('import-files', files)
    message.value = '已送往批量导入页，请确认试卷归属后创建草稿'
  })
}
function unload(event) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(() => !dirty.value || window.confirm('切分修改尚未保存，确定离开？'))
let initialized = false
async function initialize() {
  if (initialized || disposed) return
  initialized = true
  await run(async () => {
    health.value = await api('/health')
    await refreshJobs()
  })
  if (disposed) return
  timer = setInterval(async () => {
    if (disposed || !working.value || busy.value || polling) return
    polling = true
    try {
      const value = await api(`/jobs/${job.value.id}`)
      if (disposed) return
      setJob(value)
      if (!working.value) {
        message.value = value.error || '后台处理完成'
        await refreshJobs()
      }
    } catch (error) {
      message.value = error.message
    } finally {
      polling = false
    }
  }, 2500)
}
onMounted(() => {
  window.addEventListener('beforeunload', unload)
  if (props.active) void initialize()
})
watch(
  () => props.active,
  (active) => {
    if (active) void initialize()
  },
)
onBeforeUnmount(() => {
  disposed = true
  clearInterval(timer)
  window.removeEventListener('beforeunload', unload)
})
watch(pageIndex, () => {
  selected.value = ''
  drag = null
})
</script>

<template>
  <section class="split-workbench" aria-label="试卷切分工作台">
    <header>
      <h3>试卷切分 → 识别 → 草稿</h3>
      <p>先分栏，再在栏内分题。相同题号的区域会跨页合并；题干、答案和解析可分别指定。</p>
    </header>
    <p class="split-message" role="status">{{ message || '切分、预览与保存不调用付费 API。' }}</p>
    <div class="split-toolbar">
      <label class="split-upload"
        >新建任务<input
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          :disabled="busy || working || dirty"
          @change="upload($event)"
      /></label>
      <select
        aria-label="打开历史任务"
        :disabled="busy || working"
        :value="job?.id || ''"
        @change="open($event.target.value)"
      >
        <option value="" disabled>打开历史任务</option>
        <option v-for="item in jobs" :key="item.id" :value="item.id">
          {{ item.filename }} · {{ labels[item.status] }}
        </option>
      </select>
      <button
        :disabled="busy"
        @click="
          run(async () => {
            health = await api('/health')
            await refreshJobs()
          })
        "
      >
        刷新连接
      </button>
      <span v-if="health">{{
        health.onlineConfigured ? '识别服务已配置' : '离线切分可用，识别密钥未配置'
      }}</span>
    </div>
    <template v-if="job">
      <p>
        {{ job.filename }} · {{ labels[job.status] }} · {{ job.pages.length }} 页 · 累计请求
        {{ job.calls }} 次 <strong v-if="dirty">（未保存）</strong>
      </p>
      <p v-if="job.error" class="split-error">{{ job.error }}</p>
      <fieldset :disabled="working || busy">
        <legend>试卷信息（一个任务对应一套试卷）</legend>
        <div class="split-toolbar">
          <label
            >完整试卷名称<input
              v-model="job.metadata.title"
              placeholder="2020年普通高考北京卷数学"
              @input="changed"
          /></label>
          <label
            >年份<input v-model="job.metadata.year" size="4" maxlength="4" @input="changed"
          /></label>
          <label
            >来源<input v-model="job.metadata.source" placeholder="北京卷" @input="changed"
          /></label>
          <label
            >来源类别<select v-model="job.metadata.category" @change="changed">
              <option value="G">高考</option>
              <option value="E">其他正式考试</option>
              <option value="T">课本</option>
              <option value="N">其他</option>
            </select></label
          >
          <label
            >难度建议<select v-model="job.metadata.difficulty" @change="changed">
              <option value="">未确定</option>
              <option v-for="n in 7" :key="n">D{{ n }}</option>
            </select></label
          >
        </div>
      </fieldset>
      <div class="split-toolbar">
        <label class="split-upload"
          >追加页面 / 答案文件<input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            :disabled="busy || working || dirty"
            @change="upload($event, true)"
        /></label>
        <button :disabled="busy || working || !dirty" @click="run(save)">保存切分与内容</button>
        <button :disabled="busy || working || !history.length" @click="undo">撤销切分</button>
        <button :disabled="busy || working || dirty || !groups.length" @click="download('crops')">
          下载高清裁片（免费）
        </button>
      </div>
      <template v-if="page">
        <div class="split-toolbar">
          <button :disabled="pageIndex === 0" @click="pageIndex--">上一页</button>
          <select v-model="pageIndex" aria-label="页码">
            <option v-for="(p, i) in job.pages" :key="p.id" :value="i">第 {{ i + 1 }} 页</option>
          </select>
          <button :disabled="pageIndex === job.pages.length - 1" @click="pageIndex++">
            下一页
          </button>
          <button
            v-for="(title, key) in {
              select: '选择 / 拖线',
              vertical: '添加竖线',
              horizontal: '添加横线',
              delete: '删除分隔线',
            }"
            :key="key"
            :aria-pressed="mode === key"
            :disabled="working || busy"
            @click="mode = key"
          >
            {{ title }}
          </button>
          <label><input v-model="showSuggestions" type="checkbox" />显示空白建议线</label>
        </div>
        <div class="split-layout">
          <div class="split-page" :style="{ aspectRatio: `${page.width}/${page.height}` }">
            <img :src="imageUrl(page.image)" alt="试卷原始页面" draggable="false" />
            <svg
              ref="svg"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              role="img"
              aria-label="可编辑切分边界"
              @pointermove="lineMove"
              @pointerup="lineUp"
              @pointercancel="lineUp"
            >
              <g v-for="(column, c) in page.columns" :key="c">
                <g
                  v-for="band in column.bands"
                  :key="band.id"
                  @pointerdown="clickBand($event, band, c)"
                >
                  <rect
                    :x="page.edges[c]"
                    :y="band.top"
                    :width="page.edges[c + 1] - page.edges[c]"
                    :height="band.bottom - band.top"
                    :class="['split-band', { selected: selected === band.id, skipped: band.skip }]"
                  />
                  <text :x="page.edges[c] + 5" :y="band.top + 14" class="split-label">
                    {{
                      band.skip
                        ? '跳过'
                        : band.question
                          ? `T${band.question} · ${{ content: '题干', answer: '答案', solution: '解析' }[band.section]}`
                          : '未分配题号'
                    }}
                  </text>
                </g>
                <template v-if="showSuggestions">
                  <line
                    v-for="y in column.suggestions"
                    :key="y"
                    :x1="page.edges[c] + 3"
                    :x2="page.edges[c + 1] - 3"
                    :y1="y"
                    :y2="y"
                    class="split-suggestion"
                    @pointerdown.stop="applySuggestion(c, y)"
                  />
                </template>
                <line
                  v-for="(band, index) in column.bands.slice(1)"
                  :key="band.id"
                  :x1="page.edges[c]"
                  :x2="page.edges[c + 1]"
                  :y1="band.top"
                  :y2="band.top"
                  class="split-line horizontal"
                  @pointerdown="lineDown($event, { axis: 'y', column: c, index: index + 1 })"
                />
              </g>
              <line
                v-for="(x, index) in page.edges.slice(1, -1)"
                :key="index"
                :x1="x"
                :x2="x"
                y1="0"
                y2="1000"
                class="split-line vertical"
                @pointerdown="lineDown($event, { axis: 'x', index: index + 1 })"
              />
            </svg>
          </div>
          <aside>
            <p>
              虚线是空白建议，点击后成为分题线。拖动实线调整；页眉、页码和答题空白单独切块并跳过。
            </p>
            <fieldset :disabled="working || busy">
              <legend>当前区域</legend>
              <template v-if="selection">
                <label
                  ><input
                    v-model="selection.band.skip"
                    type="checkbox"
                    @change="changed"
                  />跳过这个区域</label
                >
                <label
                  >题号<input
                    v-model="selection.band.question"
                    inputmode="numeric"
                    placeholder="例如 16"
                    @input="changed"
                /></label>
                <label
                  >内容段<select v-model="selection.band.section" @change="changed">
                    <option value="content">题干</option>
                    <option value="answer">答案</option>
                    <option value="solution">解析</option>
                  </select></label
                >
                <label
                  >题型<select v-model="selection.band.type" @change="changed">
                    <option v-for="t in types" :key="t">{{ t }}</option>
                  </select></label
                >
                <a
                  v-if="!dirty"
                  :href="`${root}/jobs/${job.id}/crop/${selection.band.id}`"
                  target="_blank"
                  rel="noopener"
                  >查看该块高清裁片</a
                >
              </template>
              <p v-else>点击区域后分配题号。</p>
            </fieldset>
            <fieldset :disabled="working || busy">
              <legend>本页自动编号</legend>
              <label>起始题号<input v-model="startNumber" type="number" min="1" max="9999" /></label
              ><button @click="numberPage">按先栏后行编号</button>
              <p>跳过的区域不编号。跨页续题请手动使用相同题号；答案页不要重新建立新题号。</p>
            </fieldset>
            <p>已分组 {{ groups.length }} 题；{{ unassigned }} 个区域未分配。</p>
          </aside>
        </div>
        <fieldset :disabled="working || busy">
          <legend>识别已确认题块</legend>
          <div class="split-toolbar">
            <label
              >范围<select v-model="ocrScope">
                <option value="all">所有未缓存题目</option>
                <option value="one">当前题目</option>
              </select></label
            >
            <label>每批题数<input v-model="batchSize" type="number" min="1" max="4" /></label>
            <label>本次请求上限<input v-model="maxCalls" type="number" min="0" max="100" /></label>
            <span>未计缓存时最多 {{ requests }} 次；每次最多输出 12000 Token。</span>
          </div>
          <label
            ><input
              v-model="confirmed"
              type="checkbox"
              :disabled="dirty"
            />我已确认分题边界、题号和跨页关系</label
          >
          <label
            ><input
              v-model="online"
              type="checkbox"
            />允许将题块发送至百炼进行本次付费识别（失败不自动重试）</label
          >
          <button
            :disabled="dirty || !confirmed || !online || unassigned > 0 || !groups.length"
            @click="recognize"
          >
            开始识别
          </button>
        </fieldset>
      </template>
      <div v-if="Object.keys(job.results).length" class="split-results">
        <h4>识别结果 · 内容待人工审核</h4>
        <div class="split-toolbar">
          <select v-model="selectedQuestion" aria-label="查看题目结果">
            <option
              v-for="n in Object.keys(job.results).sort((a, b) => Number(a) - Number(b))"
              :key="n"
              :value="n"
            >
              T{{ n }}
            </option>
          </select>
          <button :disabled="dirty || busy || working" @click="download('export')">
            下载 1.4 MD＋配图
          </button>
          <button :disabled="dirty || busy || working" @click="importDrafts">
            送往批量导入（创建待审核草稿）
          </button>
        </div>
        <template v-if="editor"
          ><label
            >确认题型<select
              :value="editor.type"
              :disabled="working"
              @change="editResult('type', $event.target.value)"
            >
              <option v-for="t in types" :key="t">{{ t }}</option>
            </select></label
          >
          <div
            v-for="(label, field) in { content: '题干', answer: '答案', solution: '解析' }"
            :key="field"
            class="split-result-row"
          >
            <label
              >{{ label
              }}<textarea
                :value="editor[field]"
                :disabled="working"
                @input="editResult(field, $event.target.value)"
              />
            </label>
            <div class="split-math">
              <DocumentContentPreview
                :text="editor[field]"
                :assets="editor.assets"
                :base="`${root}/jobs/${job.id}/image/`"
              />
            </div>
          </div>
        </template>
        <p>
          无可靠原文的答案、解析保持留空。修改切分后旧结果保留，但必须重新识别对应题目后才能导出。
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.split-workbench {
  padding: 16px;
  background: #f6f8fa;
  border: 1px solid #dbe2e8;
  border-radius: 10px;
  color: #243447;
}
.split-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}
.split-toolbar label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.split-workbench button,
.split-workbench select,
.split-workbench input {
  font: inherit;
  padding: 6px;
  border: 1px solid #b8c4cf;
  border-radius: 4px;
}
.split-workbench button {
  cursor: pointer;
  background: white;
}
.split-workbench button[aria-pressed='true'] {
  background: #154e6a;
  color: white;
}
.split-workbench button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.split-workbench input[type='number'] {
  width: 65px;
}
.split-workbench fieldset {
  border: 1px solid #c9d3dc;
  border-radius: 6px;
  margin: 12px 0;
  padding: 12px;
}
.split-message {
  padding: 10px;
  background: #e7f0f5;
  white-space: pre-wrap;
}
.split-error {
  color: #a12626;
}
.split-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 14px;
  align-items: start;
}
.split-page {
  position: relative;
  background: white;
  border: 1px solid #c8d1da;
}
.split-page img,
.split-page svg {
  position: absolute;
  width: 100%;
  height: 100%;
  inset: 0;
}
.split-page svg {
  touch-action: none;
  user-select: none;
}
.split-band {
  fill: rgba(25, 105, 150, 0.015);
  stroke: none;
  cursor: crosshair;
}
.split-band.selected {
  fill: rgba(30, 130, 200, 0.17);
}
.split-band.skipped {
  fill: rgba(100, 100, 100, 0.23);
}
.split-label {
  font-size: 10px;
  fill: #0b5a84;
  paint-order: stroke;
  stroke: white;
  stroke-width: 2px;
  pointer-events: none;
}
.split-line {
  stroke: #e5542e;
  stroke-width: 4;
  opacity: 0.8;
}
.split-line.horizontal {
  cursor: ns-resize;
}
.split-line.vertical {
  cursor: ew-resize;
}
.split-suggestion {
  stroke: #00a386;
  stroke-width: 2;
  stroke-dasharray: 5 5;
  opacity: 0.45;
  cursor: copy;
}
.split-layout aside label {
  display: block;
  margin: 10px 0;
}
.split-layout aside input:not([type='checkbox']),
.split-layout aside select {
  width: 100%;
}
.split-result-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 12px 0;
}
.split-result-row textarea {
  display: block;
  width: 100%;
  min-height: 140px;
  resize: vertical;
  font: 14px/1.6 monospace;
}
.split-math {
  background: white;
  padding: 14px;
  min-width: 0;
  overflow: auto;
}
.split-upload input {
  max-width: 220px;
}
.split-workbench p {
  font-size: 14px;
  line-height: 1.65;
}
@media (max-width: 850px) {
  .split-layout {
    grid-template-columns: 1fr;
  }
  .split-result-row {
    grid-template-columns: 1fr;
  }
  .split-layout aside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
}
</style>
