<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { callAi, testAiConnection } from '../ai-assistant/aiRelay.js'
import { useAiProviderSettings } from '../ai-assistant/aiProviderStore.js'
import {
  buildUploadAnalysisMessages,
  confidenceLabel,
  normalizeUploadAnalysis,
} from './aiUploadAnalyzer.js'
import {
  inspectAiTransformation,
  inspectUploadDraft,
  UPLOAD_RULE_VERSION,
} from './uploadRuleEngine.js'
import './ai-upload.css'

const props = defineProps({
  draft: { type: Object, required: true },
  official: { type: Boolean, default: false },
  tagOptions: { type: Array, default: () => [] },
  typeOptions: { type: Array, required: true },
  levelOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['apply'])

const { apiConfig, applyProviderPreset, connectionStatus, providerLabel } = useAiProviderSettings()
const open = ref(false)
const settingsOpen = ref(false)
const loading = ref(false)
const testing = ref(false)
const error = ref('')
const appliedMessage = ref('')
const analysis = ref(null)
const meta = ref(null)
const analyzedFingerprint = ref('')
const selected = reactive({
  title: true,
  content: true,
  answer: true,
  solution: true,
  type: true,
  level: true,
  tags: true,
})
let controller = null

const configured = computed(() => Boolean(apiConfig.endpoint && apiConfig.model && apiConfig.key))
const catalogs = computed(() => ({
  types: props.typeOptions,
  levels: props.levelOptions,
  tags: props.tagOptions,
}))
const fingerprint = computed(() =>
  JSON.stringify({
    title: props.draft.title || '',
    content: props.draft.content || '',
    answer: props.draft.answer || '',
    solution: props.draft.solution || '',
    type: props.draft.type || '',
    level: props.draft.level || '',
    tags: props.draft.tags || [],
  }),
)
const resultStale = computed(
  () => Boolean(analysis.value && analyzedFingerprint.value !== fingerprint.value),
)
const typeLabel = computed(
  () => props.typeOptions.find((item) => item.value === analysis.value?.type)?.label || '未识别',
)
const levelLabel = computed(
  () => props.levelOptions.find((item) => item.value === analysis.value?.level)?.label || '未识别',
)
const changedTextFields = computed(() =>
  ['title', 'content', 'answer', 'solution'].filter(
    (field) => analysis.value?.[field] !== String(props.draft[field] || '').trim(),
  ),
)
const fieldLabels = { title: '标题', content: '题干', answer: '答案', solution: '解析' }
const ruleReport = computed(() =>
  inspectUploadDraft(props.draft, catalogs.value, { official: props.official }),
)
const selectedCandidate = computed(() => {
  const candidate = {
    ...props.draft,
    tags: Array.isArray(props.draft.tags) ? [...props.draft.tags] : [],
  }
  if (!analysis.value) return candidate
  for (const field of ['title', 'content', 'answer', 'solution', 'type', 'level', 'tags']) {
    if (!selected[field]) continue
    const value = analysis.value[field]
    if (field === 'tags') candidate.tags = [...value]
    else if (value) candidate[field] = value
  }
  return candidate
})
const suggestionRuleReport = computed(() =>
  analysis.value
    ? inspectAiTransformation(props.draft, selectedCandidate.value, catalogs.value, {
        official: props.official,
      })
    : null,
)

function configSnapshot() {
  return {
    endpoint: apiConfig.endpoint.trim(),
    model: apiConfig.model.trim(),
    key: apiConfig.key.trim(),
    timeout: apiConfig.timeout,
  }
}

function resetSelection() {
  for (const key of Object.keys(selected)) selected[key] = true
}

function applySafeCleanup() {
  emit('apply', ruleReport.value.cleanup)
  appliedMessage.value = '已完成本地安全整理：统一换行、移除行尾空格并压缩过多空行；没有改动数学内容'
}

async function analyze() {
  if (!String(props.draft.content || '').trim()) {
    error.value = '请先填写题干，再让 AI 分析'
    return
  }
  error.value = ''
  appliedMessage.value = ''
  loading.value = true
  controller = new AbortController()
  const startedFingerprint = fingerprint.value
  try {
    const result = await callAi({
      config: configSnapshot(),
      taskType: props.official ? 'official-upload-analysis' : 'community-upload-analysis',
      maxTokens: 3000,
      jsonMode: true,
      signal: controller.signal,
      messages: buildUploadAnalysisMessages(props.draft, catalogs.value, props.official),
    })
    analysis.value = normalizeUploadAnalysis(result.content, catalogs.value, props.draft)
    analyzedFingerprint.value = startedFingerprint
    meta.value = result
    resetSelection()
  } catch (reason) {
    error.value = reason?.message || 'AI 分析失败，请稍后重试'
  } finally {
    controller = null
    loading.value = false
  }
}

function stop() {
  controller?.abort()
}

function applySuggestions() {
  if (!analysis.value || resultStale.value) return
  if (!suggestionRuleReport.value?.valid) {
    error.value = '所选 AI 建议没有通过规则校验。请取消勾选被拦截的文本改动后再应用。'
    return
  }
  const updates = {}
  for (const field of ['title', 'content', 'answer', 'solution', 'type', 'level', 'tags']) {
    if (!selected[field]) continue
    const value = analysis.value[field]
    if (field === 'tags') updates.tags = [...value]
    else if (value) updates[field] = value
  }
  emit('apply', updates)
  analyzedFingerprint.value = JSON.stringify({
    title: updates.title ?? props.draft.title ?? '',
    content: updates.content ?? props.draft.content ?? '',
    answer: updates.answer ?? props.draft.answer ?? '',
    solution: updates.solution ?? props.draft.solution ?? '',
    type: updates.type ?? props.draft.type ?? '',
    level: updates.level ?? props.draft.level ?? '',
    tags: updates.tags ?? props.draft.tags ?? [],
  })
  appliedMessage.value = '已把所选建议填入表单，请继续人工核对后再提交'
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
  } catch (reason) {
    connectionStatus.value = { tone: 'error', message: reason?.message || '连接失败' }
  } finally {
    testing.value = false
  }
}

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section :class="['ai-upload', { 'is-official': official, 'is-open': open }]">
    <button
      v-if="!open"
      class="ai-upload-launcher"
      type="button"
      :aria-label="official ? '打开官方 AI 辅助上传' : '打开 AI 辅助上传'"
      @click="open = true"
    >
      <span aria-hidden="true">AI</span>
      <strong>{{ official ? 'AI 辅助分类' : 'AI 辅助上传（可选）' }}</strong>
      <small>{{ official ? '先按规则 1.4 检查，再识别题型、难度与标签' : '无需 API 也能检查规则；API 用于分类建议' }}</small>
    </button>

    <div v-else class="ai-upload-panel">
      <header class="ai-upload-header">
        <div>
          <span>UPLOAD RULE {{ UPLOAD_RULE_VERSION }}</span>
          <h3>{{ official ? '官方上传检查与 AI 辅助' : '上传检查与 AI 辅助' }}</h3>
          <p>
            {{ official ? '规则检查是确定性的；AI 只给建议，未通过校验的结果不能应用。' : '本地规则检查不需要 API；是否再使用个人 API 完全由你决定。' }}
          </p>
        </div>
        <button type="button" aria-label="关闭 AI 辅助上传" @click="open = false">关闭</button>
      </header>

      <section class="ai-upload-rule-check" aria-live="polite">
        <div class="ai-upload-rule-heading">
          <div>
            <strong>规则 {{ ruleReport.version }} 即时检查</strong>
            <span>在浏览器本地运行，不发送题目，也不产生费用</span>
          </div>
          <b :class="ruleReport.valid ? 'is-pass' : 'is-blocked'">
            {{ ruleReport.valid ? `可继续 · ${ruleReport.warnings.length} 项提醒` : `需修正 · ${ruleReport.errors.length} 项` }}
          </b>
        </div>
        <ul v-if="ruleReport.issues.length" class="ai-upload-rule-list">
          <li v-for="issue in ruleReport.issues" :key="issue.id" :class="`is-${issue.severity}`">
            <span>{{ issue.severity === 'error' ? '必须修正' : '建议核对' }}</span>
            <div><strong>{{ issue.title }}</strong><small>{{ issue.detail }}</small></div>
          </li>
        </ul>
        <p v-else class="ai-upload-rule-pass">标题、题干、题型、公式、材料段、图片地址和分类值均通过当前规则检查。</p>
        <button v-if="ruleReport.cleanupChanged" type="button" @click="applySafeCleanup">
          安全整理空格与换行
        </button>
      </section>

      <div class="ai-upload-status-row">
        <span :class="['ai-upload-provider', { 'is-ready': configured }]">
          {{ configured ? `已连接设置 · ${providerLabel}` : '尚未配置个人 API' }}
        </span>
        <button type="button" @click="settingsOpen = !settingsOpen">
          {{ settingsOpen ? '收起 API 设置' : 'API 设置' }}
        </button>
      </div>

      <div v-if="settingsOpen || !configured" class="ai-upload-settings">
        <p>这里与右侧学习助手共用设置。API Key 只保存在当前页面内存中。</p>
        <div class="ai-upload-presets" aria-label="模型厂商预设">
          <button type="button" @click="applyProviderPreset('deepseek')">DeepSeek</button>
          <button type="button" @click="applyProviderPreset('qwen')">Qwen 百炼</button>
          <button type="button" @click="applyProviderPreset('openai')">OpenAI</button>
        </div>
        <label>
          <span>Chat Completions 地址</span>
          <input v-model.trim="apiConfig.endpoint" type="url" autocomplete="off" placeholder="https://…/chat/completions" />
        </label>
        <div class="ai-upload-settings-grid">
          <label><span>模型</span><input v-model.trim="apiConfig.model" autocomplete="off" /></label>
          <label><span>超时（秒）</span><input v-model.number="apiConfig.timeout" type="number" min="5" max="120" /></label>
        </div>
        <label>
          <span>API Key</span>
          <input v-model="apiConfig.key" type="password" autocomplete="off" placeholder="填写对应厂商的 Key" />
        </label>
        <div class="ai-upload-test-row">
          <button type="button" :disabled="testing" @click="testConnection">
            {{ testing ? '连接中…' : '测试连接' }}
          </button>
          <span :class="connectionStatus.tone" role="status">{{ connectionStatus.message }}</span>
        </div>
      </div>

      <div class="ai-upload-run-row">
        <div>
          <strong>用个人 API 分析分类与格式（可选）</strong>
          <span>会发送题干、答案和解析；输出必须再次通过规则引擎，且不会自动写入。</span>
        </div>
        <button v-if="loading" class="is-stop" type="button" @click="stop">停止分析</button>
        <button v-else type="button" :disabled="!configured" @click="analyze">开始分析</button>
      </div>

      <p v-if="error" class="ai-upload-message is-error" role="alert">{{ error }}</p>
      <p v-if="resultStale" class="ai-upload-message is-warning" role="alert">
        分析后表单已经变化。为防止覆盖新内容，请重新分析后再应用。
      </p>
      <p v-if="appliedMessage" class="ai-upload-message is-success" role="status">
        {{ appliedMessage }}
      </p>
      <p
        v-if="analysis && suggestionRuleReport && !suggestionRuleReport.valid"
        class="ai-upload-message is-error"
        role="alert"
      >
        已拦截所选建议：{{ suggestionRuleReport.errors.map((item) => item.title).join('；') }}。
        可取消勾选相应文本改动，只采用通过校验的分类建议。
      </p>

      <div v-if="analysis" class="ai-upload-result">
        <div class="ai-upload-result-heading">
          <div><span>AI 建议</span><h4>逐项选择后再应用</h4></div>
          <small v-if="meta">{{ meta.model }} · {{ meta.elapsedMs }} ms<span v-if="meta.usage?.totalTokens"> · {{ meta.usage.totalTokens }} Token</span></small>
        </div>

        <div class="ai-upload-classification">
          <label>
            <input v-model="selected.type" type="checkbox" :disabled="!analysis.type" />
            <span>题型</span>
            <strong>{{ typeLabel }}</strong>
            <small>{{ confidenceLabel(analysis.confidence.type) }}<template v-if="analysis.reasons.type"> · {{ analysis.reasons.type }}</template></small>
          </label>
          <label>
            <input v-model="selected.level" type="checkbox" :disabled="!analysis.level" />
            <span>难度</span>
            <strong>{{ levelLabel }}</strong>
            <small>{{ confidenceLabel(analysis.confidence.level) }}<template v-if="analysis.reasons.level"> · {{ analysis.reasons.level }}</template></small>
          </label>
          <label class="is-tags">
            <input v-model="selected.tags" type="checkbox" :disabled="!analysis.tags.length" />
            <span>标准标签</span>
            <strong>{{ analysis.tags.length ? analysis.tags.join('、') : '没有可靠匹配' }}</strong>
            <small>{{ confidenceLabel(analysis.confidence.tags) }}<template v-if="analysis.reasons.tags"> · {{ analysis.reasons.tags }}</template></small>
          </label>
        </div>

        <fieldset v-if="changedTextFields.length" class="ai-upload-text-changes">
          <legend>格式与字段整理 · {{ confidenceLabel(analysis.confidence.format) }}</legend>
          <label v-for="field in changedTextFields" :key="field">
            <input v-model="selected[field]" type="checkbox" />
            <span>采用整理后的{{ fieldLabels[field] }}</span>
            <small>{{ analysis[field].slice(0, 140) }}{{ analysis[field].length > 140 ? '…' : '' }}</small>
          </label>
        </fieldset>

        <div v-if="analysis.unmappedTags.length" class="ai-upload-unmapped">
          <strong>未能映射到站内标准标签</strong>
          <span>{{ analysis.unmappedTags.join('、') }}</span>
        </div>
        <ul v-if="analysis.warnings.length" class="ai-upload-warnings">
          <li v-for="warning in analysis.warnings" :key="warning">{{ warning }}</li>
        </ul>

        <footer class="ai-upload-result-actions">
          <span>AI 可能出错，应用后仍需核对原题。</span>
          <button
            type="button"
            :disabled="resultStale || !suggestionRuleReport?.valid"
            @click="applySuggestions"
          >
            通过规则校验并应用
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>
