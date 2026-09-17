<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { callAi, testAiConnection } from './aiRelay.js'
import { recordAiCall, useAiProviderSettings } from './aiProviderStore.js'
import { useAssistantContext } from './assistantContext.js'
import './ai-assistant.css'

const route = useRoute()
const router = useRouter()
const { effectiveContext } = useAssistantContext(route)
const {
  apiConfig,
  applyProviderPreset,
  connectionStatus,
  lastCall,
  providerLabel,
} = useAiProviderSettings()

const open = ref(false)
const panel = ref('chat')
const mode = ref('standard')
const input = ref('')
const includeContext = ref(true)
const includeSolution = ref(false)
const forceNextCall = ref(false)
const loading = ref(false)
const testing = ref(false)
const messages = ref([])
const composer = ref(null)
const conversation = ref(null)
const drawer = ref(null)
const launcher = ref(null)
const restoreTab = ref(null)
const launcherHidden = ref(false)
const draggingLauncher = ref(false)
const draggingRestore = ref(false)
const overHideTarget = ref(false)
const launcherPosition = ref({ x: 0, y: 0 })
const drawerSize = ref({ width: 440, height: 720 })
const resizingDrawer = ref(false)
const responseCache = new Map()
let activeController = null
let dragState = null
let restoreDragState = null
let drawerResizeState = null
let suppressLauncherClick = false
let suppressRestoreClick = false

const HIDE_TARGET_SIZE = 150
const VIEWPORT_GAP = 10

const hasProblemContext = computed(() => effectiveContext.value.type === 'problem' && Boolean(effectiveContext.value.text))
const contextLabel = computed(() => {
  const value = effectiveContext.value
  if (value.type === 'problem') return `${value.id} · ${value.title || '当前题目'}`
  return value.title || '当前页面'
})
const canSend = computed(() => Boolean(input.value.trim()) && !loading.value)
const lastUsage = computed(() => lastCall.value?.usage)
const launcherStyle = computed(() => ({
  left: `${launcherPosition.value.x}px`,
  top: `${launcherPosition.value.y}px`,
}))
const drawerStyle = computed(() => ({
  width: `${drawerSize.value.width}px`,
  height: `${drawerSize.value.height}px`,
}))
const quickTasks = computed(() => {
  const tasks = []
  if (hasProblemContext.value) {
    tasks.push(
      { id: 'hint', label: '给一个提示', description: '只提示下一步，不公布完整答案' },
      { id: 'explain', label: '解释当前题', description: '分析考点、思路和关键步骤' },
      { id: 'similar', label: '寻找相似题', description: '进入同方法题目推荐页面', local: true },
    )
  } else {
    tasks.push({ id: 'search-help', label: '如何找题', description: '把训练目标转成可搜索的关键词' })
  }
  return tasks
})

function configSnapshot() {
  return {
    endpoint: apiConfig.endpoint.trim(),
    model: apiConfig.model.trim(),
    key: apiConfig.key.trim(),
    timeout: apiConfig.timeout,
  }
}

function buildContextBlock() {
  if (!includeContext.value) return ''
  const value = effectiveContext.value
  const parts = [`当前上下文：${contextLabel.value}`]
  if (value.tags?.length) parts.push(`现有标签：${value.tags.join('、')}`)
  if (value.text) parts.push(`题目：\n${value.text}`)
  if (includeSolution.value && value.answer) parts.push(`参考答案：\n${value.answer}`)
  if (includeSolution.value && value.solution) parts.push(`参考解析：\n${value.solution}`)
  return parts.join('\n\n')
}

function taskPrompt(taskType, userText = '') {
  const contextBlock = buildContextBlock()
  const prompts = {
    hint: '请只给出一个能够推动学生继续思考的提示。不要直接给最终答案，也不要展开完整解法。',
    explain: '请分析这道题的考点、突破口和关键步骤，再给出清晰但不过度冗长的讲解。若仅凭题干无法确定唯一方法，请明确说明。',
    'search-help': '请把用户的训练目标整理成适合高考数学题库搜索的知识点、题型结构和方法关键词。',
    chat: userText,
  }
  return [contextBlock, prompts[taskType] || userText].filter(Boolean).join('\n\n')
}

function cacheKey(taskType, content) {
  return JSON.stringify({
    taskType,
    endpoint: apiConfig.endpoint,
    model: apiConfig.model,
    mode: mode.value,
    context: includeContext.value ? effectiveContext.value : null,
    content,
  })
}

async function scrollConversation() {
  await nextTick()
  if (conversation.value) conversation.value.scrollTop = conversation.value.scrollHeight
}

async function runTask(taskType, userText = '') {
  if (taskType === 'similar') {
    const query = effectiveContext.value.text
    await router.push({ name: 'similar-problems', query: query ? { q: query } : {} })
    open.value = false
    return
  }

  const content = taskPrompt(taskType, userText)
  const key = cacheKey(taskType, content)
  const userLabel = taskType === 'chat' ? userText : quickTasks.value.find((task) => task.id === taskType)?.label || taskType
  messages.value.push({ role: 'user', content: userLabel })
  loading.value = true
  await scrollConversation()

  try {
    let result
    if (!forceNextCall.value && responseCache.has(key)) {
      result = { ...responseCache.get(key), cached: true, elapsedMs: 0 }
      recordAiCall({ status: 'success', ...result })
    } else {
      const history = taskType === 'chat'
        ? messages.value
            .slice(-7, -1)
            .filter(({ role }) => role === 'user' || role === 'assistant')
            .map(({ role, content: historyContent }) => ({ role, content: historyContent }))
        : []
      activeController = new AbortController()
      result = await callAi({
        config: configSnapshot(),
        taskType: `assistant-${taskType}`,
        maxTokens: taskType === 'hint' ? 500 : mode.value === 'quick' ? 700 : 1400,
        lowLatency: mode.value === 'quick',
        signal: activeController.signal,
        messages: [
          {
            role: 'system',
            content: '你是 MathSea 高考数学学习助手。回答必须基于用户提供的题目和上下文；不确定时明确说明，不得编造题库内容。使用简洁中文和规范数学表达。',
          },
          ...history,
          { role: 'user', content },
        ],
      })
      responseCache.set(key, result)
    }
    messages.value.push({ role: 'assistant', content: result.content, meta: result })
    forceNextCall.value = false
  } catch (error) {
    messages.value.push({ role: 'error', content: error.message || '调用失败，请检查 API 设置' })
  } finally {
    activeController = null
    loading.value = false
    await scrollConversation()
  }
}

function stopRequest() {
  activeController?.abort()
}

async function sendMessage() {
  if (!canSend.value) return
  const value = input.value.trim()
  input.value = ''
  await runTask('chat', value)
}

async function testConnection() {
  testing.value = true
  connectionStatus.value = { tone: '', message: '正在连接…' }
  try {
    const result = await testAiConnection(configSnapshot())
    connectionStatus.value = {
      tone: 'success',
      message: result.usage?.totalTokens ? `连接成功 · ${result.usage.totalTokens} Token` : '连接成功',
    }
  } catch (error) {
    connectionStatus.value = { tone: 'error', message: error.message || '连接失败' }
  } finally {
    testing.value = false
  }
}

function openDrawer() {
  open.value = true
  if (!apiConfig.endpoint) panel.value = 'settings'
  nextTick(() => {
    clampDrawerSize()
    composer.value?.focus()
  })
}

function normalizeDrawerSize(size) {
  const maximumWidth = Math.max(280, window.innerWidth - 28)
  const maximumHeight = Math.max(320, window.innerHeight - 28)
  const minimumWidth = Math.min(320, maximumWidth)
  const minimumHeight = Math.min(360, maximumHeight)
  return {
    width: Math.round(Math.min(Math.max(minimumWidth, size.width), Math.min(720, maximumWidth))),
    height: Math.round(Math.min(Math.max(minimumHeight, size.height), maximumHeight)),
  }
}

function clampDrawerSize() {
  drawerSize.value = normalizeDrawerSize(drawerSize.value)
}

function resetDrawerSize() {
  drawerSize.value = normalizeDrawerSize({ width: 440, height: window.innerHeight - 28 })
}

function startDrawerResize(event, axis) {
  if (event.button !== undefined && event.button !== 0) return
  const rect = drawer.value?.getBoundingClientRect()
  if (!rect) return
  drawerResizeState = {
    pointerId: event.pointerId,
    axis,
    startX: event.clientX,
    startY: event.clientY,
    width: rect.width,
    height: rect.height,
    target: event.currentTarget,
  }
  event.currentTarget.setPointerCapture?.(event.pointerId)
  resizingDrawer.value = true
}

function moveDrawerResize(event) {
  if (!drawerResizeState || drawerResizeState.pointerId !== event.pointerId) return
  const width = drawerResizeState.axis === 'height'
    ? drawerResizeState.width
    : drawerResizeState.width + drawerResizeState.startX - event.clientX
  const height = drawerResizeState.axis === 'width'
    ? drawerResizeState.height
    : drawerResizeState.height + event.clientY - drawerResizeState.startY
  drawerSize.value = normalizeDrawerSize({ width, height })
}

function finishDrawerResize(event) {
  if (!drawerResizeState || drawerResizeState.pointerId !== event.pointerId) return
  drawerResizeState.target?.releasePointerCapture?.(event.pointerId)
  drawerResizeState = null
  resizingDrawer.value = false
}

function launcherBounds() {
  const rect = launcher.value?.getBoundingClientRect()
  return {
    width: rect?.width || 126,
    height: rect?.height || 48,
  }
}

function clampLauncherPosition(position = launcherPosition.value) {
  const { width, height } = launcherBounds()
  launcherPosition.value = {
    x: Math.min(Math.max(VIEWPORT_GAP, position.x), Math.max(VIEWPORT_GAP, window.innerWidth - width - VIEWPORT_GAP)),
    y: Math.min(Math.max(VIEWPORT_GAP, position.y), Math.max(VIEWPORT_GAP, window.innerHeight - height - VIEWPORT_GAP)),
  }
}

function resetLauncherPosition() {
  const { width, height } = launcherBounds()
  const mobileNavigationOffset = window.innerWidth <= 700 ? 76 : 26
  launcherPosition.value = {
    x: window.innerWidth - width - (window.innerWidth <= 700 ? 12 : 22),
    y: window.innerHeight - height - mobileNavigationOffset,
  }
  clampLauncherPosition()
}

function handleViewportResize() {
  clampLauncherPosition()
  clampDrawerSize()
}

function isInsideHideTarget(clientX, clientY) {
  return clientX >= window.innerWidth - HIDE_TARGET_SIZE && clientY <= HIDE_TARGET_SIZE
}

function startLauncherDrag(event) {
  if (event.button !== undefined && event.button !== 0) return
  const rect = launcher.value.getBoundingClientRect()
  dragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    startX: event.clientX,
    startY: event.clientY,
  }
  launcher.value.setPointerCapture?.(event.pointerId)
}

function moveLauncher(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
  if (!draggingLauncher.value && distance < 5) return
  draggingLauncher.value = true
  overHideTarget.value = isInsideHideTarget(event.clientX, event.clientY)
  clampLauncherPosition({
    x: event.clientX - dragState.offsetX,
    y: event.clientY - dragState.offsetY,
  })
}

function finishLauncherDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return
  launcher.value?.releasePointerCapture?.(event.pointerId)
  if (draggingLauncher.value) {
    suppressLauncherClick = true
    launcherHidden.value = overHideTarget.value
    window.setTimeout(() => { suppressLauncherClick = false }, 0)
  }
  dragState = null
  draggingLauncher.value = false
  overHideTarget.value = false
}

function handleLauncherClick() {
  if (!suppressLauncherClick) openDrawer()
}

function restoreLauncher() {
  if (suppressRestoreClick) return
  launcherHidden.value = false
  nextTick(resetLauncherPosition)
}

function startRestoreDrag(event) {
  if (event.button !== undefined && event.button !== 0) return
  restoreDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  }
  restoreTab.value.setPointerCapture?.(event.pointerId)
}

function moveRestoreDrag(event) {
  if (!restoreDragState || restoreDragState.pointerId !== event.pointerId) return
  const distance = Math.hypot(event.clientX - restoreDragState.startX, event.clientY - restoreDragState.startY)
  if (!draggingRestore.value && distance < 5) return
  draggingRestore.value = true
  clampLauncherPosition({ x: event.clientX - 63, y: event.clientY - 24 })
}

function finishRestoreDrag(event) {
  if (!restoreDragState || restoreDragState.pointerId !== event.pointerId) return
  restoreTab.value?.releasePointerCapture?.(event.pointerId)
  if (draggingRestore.value) {
    suppressRestoreClick = true
    if (restoreDragState.startX - event.clientX >= 24) launcherHidden.value = false
    window.setTimeout(() => { suppressRestoreClick = false }, 0)
  }
  restoreDragState = null
  draggingRestore.value = false
}

function clearConversation() {
  messages.value = []
}

function handleKeydown(event) {
  if (event.key === 'Escape' && open.value) open.value = false
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleViewportResize)
  resetDrawerSize()
  nextTick(resetLauncherPosition)
})
onBeforeUnmount(() => {
  activeController?.abort()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<template>
  <div
    v-if="draggingLauncher"
    :class="['ai-assistant-hide-target', { 'is-active': overHideTarget }]"
    aria-hidden="true"
  >
    <span>收起</span>
    <strong>拖到此处隐藏</strong>
  </div>

  <button
    v-if="!open && !launcherHidden"
    ref="launcher"
    :class="['ai-assistant-launcher', { 'is-dragging': draggingLauncher }]"
    :style="launcherStyle"
    type="button"
    aria-label="打开 MathSea AI 助手"
    @click="handleLauncherClick"
    @pointerdown="startLauncherDrag"
    @pointermove="moveLauncher"
    @pointerup="finishLauncherDrag"
    @pointercancel="finishLauncherDrag"
  >
    <span aria-hidden="true">AI</span>
    <strong>学习助手<small>可拖动</small></strong>
  </button>

  <button
    v-if="!open && launcherHidden"
    ref="restoreTab"
    class="ai-assistant-restore-tab"
    type="button"
    aria-label="显示 MathSea AI 学习助手"
    title="点击显示，或向左拖出 AI 学习助手"
    @click="restoreLauncher"
    @pointerdown="startRestoreDrag"
    @pointermove="moveRestoreDrag"
    @pointerup="finishRestoreDrag"
    @pointercancel="finishRestoreDrag"
  >
    <span>AI</span>
  </button>

  <div
    v-if="draggingRestore"
    class="ai-assistant-launcher ai-assistant-launcher-preview"
    :style="launcherStyle"
    aria-hidden="true"
  >
    <span>AI</span>
    <strong>学习助手<small>松开以恢复</small></strong>
  </div>

  <Transition name="ai-assistant-drawer">
    <aside
      v-if="open"
      ref="drawer"
      :class="['ai-assistant-drawer', { 'is-resizing': resizingDrawer }]"
      :style="drawerStyle"
      role="dialog"
      aria-label="MathSea AI 学习助手"
    >
      <button
        class="ai-assistant-resize-handle is-width"
        type="button"
        aria-label="调整对话框宽度"
        title="左右拖动调整宽度"
        @pointerdown="startDrawerResize($event, 'width')"
        @pointermove="moveDrawerResize"
        @pointerup="finishDrawerResize"
        @pointercancel="finishDrawerResize"
      ></button>
      <button
        class="ai-assistant-resize-handle is-height"
        type="button"
        aria-label="调整对话框高度"
        title="上下拖动调整高度"
        @pointerdown="startDrawerResize($event, 'height')"
        @pointermove="moveDrawerResize"
        @pointerup="finishDrawerResize"
        @pointercancel="finishDrawerResize"
      ></button>
      <button
        class="ai-assistant-resize-handle is-corner"
        type="button"
        aria-label="调整对话框宽度和高度"
        title="拖动同时调整宽度和高度，双击恢复默认尺寸"
        @dblclick="resetDrawerSize"
        @pointerdown="startDrawerResize($event, 'both')"
        @pointermove="moveDrawerResize"
        @pointerup="finishDrawerResize"
        @pointercancel="finishDrawerResize"
      ></button>
      <header class="ai-assistant-header">
        <div>
          <p>MathSea AI</p>
          <h2>学习助手</h2>
        </div>
        <div class="ai-assistant-header-actions">
          <button class="ai-assistant-icon-button" type="button" aria-label="恢复默认对话框大小" title="恢复默认尺寸" @click="resetDrawerSize">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4.8 9A7.5 7.5 0 1 1 5 16.1"/><path d="M4.8 4.8V9h4.3"/></svg>
          </button>
          <button class="ai-assistant-settings-toggle" type="button" :class="{ 'is-active': panel === 'settings' }" @click="panel = panel === 'settings' ? 'chat' : 'settings'">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>
            <span>设置</span>
          </button>
          <button class="ai-assistant-icon-button" type="button" aria-label="关闭 AI 助手" title="关闭" @click="open = false">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </div>
      </header>

      <section v-if="panel === 'settings'" class="ai-assistant-settings">
        <div class="ai-assistant-section-heading">
          <div><span>个人 API</span><h3>模型连接</h3></div>
          <small>Key 仅保存在当前页面内存</small>
        </div>

        <div class="ai-assistant-provider-list" aria-label="模型厂商预设">
          <button type="button" @click="applyProviderPreset('deepseek')">DeepSeek</button>
          <button type="button" @click="applyProviderPreset('qwen')">Qwen 百炼</button>
          <button type="button" @click="applyProviderPreset('openai')">OpenAI</button>
        </div>

        <label class="ai-assistant-field">
          <span>Chat Completions 地址</span>
          <input v-model.trim="apiConfig.endpoint" type="url" autocomplete="off" placeholder="https://…/chat/completions" />
        </label>
        <div class="ai-assistant-field-row">
          <label class="ai-assistant-field"><span>模型</span><input v-model.trim="apiConfig.model" autocomplete="off" /></label>
          <label class="ai-assistant-field"><span>超时（秒）</span><input v-model.number="apiConfig.timeout" type="number" min="5" max="120" /></label>
        </div>
        <label class="ai-assistant-field">
          <span>API Key</span>
          <input v-model="apiConfig.key" type="password" autocomplete="off" placeholder="填写对应厂商的 Key" />
        </label>
        <div class="ai-assistant-connection-row">
          <button type="button" :disabled="testing" @click="testConnection">{{ testing ? '连接中…' : '测试连接' }}</button>
          <span :class="connectionStatus.tone" role="status">{{ connectionStatus.message }}</span>
        </div>
        <p class="ai-assistant-security-note">题目与对话将通过 MathSea 同源中转发送给所选厂商。中转不保存 Key，并限制为已允许的官方 HTTPS 地址。</p>
        <button class="ai-assistant-back" type="button" @click="panel = 'chat'">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14 7-5 5 5 5"/><path d="M9 12h9"/></svg>
          返回对话
        </button>
      </section>

      <template v-else>
        <section class="ai-assistant-context">
          <div>
            <span>当前上下文</span>
            <strong>{{ contextLabel }}</strong>
          </div>
          <label><input v-model="includeContext" type="checkbox" /> 随请求发送</label>
          <label v-if="hasProblemContext && (effectiveContext.answer || effectiveContext.solution)"><input v-model="includeSolution" type="checkbox" /> 包含答案解析</label>
        </section>

        <section class="ai-assistant-mode" aria-label="工作强度">
          <button type="button" :class="{ 'is-active': mode === 'quick' }" @click="mode = 'quick'">快速</button>
          <button type="button" :class="{ 'is-active': mode === 'standard' }" @click="mode = 'standard'">标准</button>
          <button type="button" disabled title="后续阶段开放">深度 · 规划中</button>
        </section>

        <section class="ai-assistant-quick-tasks" aria-label="快捷任务">
          <button v-for="task in quickTasks" :key="task.id" type="button" :disabled="loading" @click="runTask(task.id)">
            <strong>{{ task.label }}</strong><span>{{ task.description }}</span>
          </button>
        </section>

        <section ref="conversation" class="ai-assistant-conversation" aria-live="polite">
          <div v-if="!messages.length" class="ai-assistant-welcome">
            <span aria-hidden="true">∿</span>
            <h3>从当前页面开始</h3>
            <p>我可以读取上方明确列出的上下文，也可以只回答你手动输入的问题。</p>
          </div>
          <article v-for="(message, index) in messages" :key="index" :class="['ai-assistant-message', `is-${message.role}`]">
            <span>{{ message.role === 'user' ? '你' : message.role === 'error' ? '错误' : 'AI' }}</span>
            <p>{{ message.content }}</p>
            <small v-if="message.meta">{{ message.meta.cached ? '缓存结果' : '厂商返回' }} · {{ message.meta.elapsedMs }} ms</small>
          </article>
          <div v-if="loading" class="ai-assistant-thinking"><i></i><i></i><i></i><span>模型正在处理…</span></div>
        </section>

        <section v-if="lastCall" class="ai-assistant-call-meta" aria-label="最近一次调用信息">
          <div><span>调用状态</span><strong>{{ lastCall.cached ? '缓存命中' : lastCall.status === 'success' ? '真实请求' : '请求失败' }}</strong></div>
          <div><span>模型</span><strong>{{ lastCall.model || providerLabel }}</strong></div>
          <div><span>Token</span><strong>{{ lastUsage?.totalTokens ?? '—' }}</strong></div>
          <div><span>耗时</span><strong>{{ lastCall.elapsedMs ?? '—' }} ms</strong></div>
          <p v-if="lastCall.providerRequestId">请求 ID：{{ lastCall.providerRequestId }}</p>
        </section>

        <footer class="ai-assistant-composer">
          <label class="ai-assistant-force"><input v-model="forceNextCall" type="checkbox" /> 强制重新调用，不使用缓存</label>
          <div>
            <textarea ref="composer" v-model="input" rows="2" placeholder="向 AI 提问…" @keydown.ctrl.enter.prevent="sendMessage"></textarea>
            <button v-if="loading" class="ai-assistant-submit-button is-stop" type="button" @click="stopRequest">
              <span>停止</span><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
            </button>
            <button v-else class="ai-assistant-submit-button" type="button" :disabled="!canSend" @click="sendMessage">
              <span>发送</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 14-7-4 14-3-6-7-1Z"/><path d="m12 13 7-8"/></svg>
            </button>
          </div>
          <p>Ctrl + Enter 发送 · <button type="button" @click="clearConversation">清空对话</button></p>
        </footer>
      </template>
    </aside>
  </Transition>
</template>
