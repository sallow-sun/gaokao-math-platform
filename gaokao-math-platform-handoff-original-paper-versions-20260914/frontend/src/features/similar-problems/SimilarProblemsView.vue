<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAiProviderSettings } from '../ai-assistant/aiProviderStore.js'
import { FEATURE_OUTPUT_SCHEMA, extractFeaturesWithApi, testFeatureApi } from './featureApi.js'
import {
  formatImageBytes,
  prepareSimilarityImage,
  SIMILARITY_IMAGE_ACCEPT,
} from './imageInput.js'
import { SIMILARITY_DEMO_CORPUS, SIMILARITY_SAMPLES } from './demoCorpus.js'
import {
  SIMILARITY_MODES,
  extractLocalFeatures,
  rankSimilarProblems,
  recommendationConfidence,
} from './similarityEngine.js'
import './similar-problems.css'

const route = useRoute()
const incomingQuery = String(route.query.q || '').trim()
const sampleKey = ref(incomingQuery ? 'current-page' : 'derivative')
const query = ref(incomingQuery || SIMILARITY_SAMPLES.derivative.text)
const imageFileInput = ref(null)
const imageInput = ref(null)
const imageConsent = ref(false)
const imagePreparing = ref(false)
const imageError = ref('')
const imageDragActive = ref(false)
const engine = ref('local')
const mode = ref('comprehensive')
const loading = ref(false)
const testingApi = ref(false)
const apiStatus = ref({ message: '尚未测试', tone: '' })
const errorMessage = ref('')
const hasRun = ref(false)
const results = ref([])
const extracted = ref(null)
const currentStep = ref(-1)
const { apiConfig, applyProviderPreset: applySharedProviderPreset } = useAiProviderSettings()
let extractionCache = null

const pipeline = computed(() => imageInput.value
  ? ['识别图片', '统一标签', '策略召回', '质量排序']
  : ['解析题干', '统一标签', '策略召回', '质量排序'])
const currentSample = computed(() => SIMILARITY_SAMPLES[sampleKey.value])
const canRunRecommendation = computed(() => {
  if (loading.value || imagePreparing.value) return false
  if (imageInput.value) return engine.value === 'api' && imageConsent.value
  return Boolean(query.value.trim())
})
const resultConfidence = computed(() => recommendationConfidence(results.value))
const featureChips = computed(() => {
  if (!extracted.value) return []
  return [
    ...extracted.value.knowledge.map((value) => ({ kind: '知识', value, core: true })),
    ...extracted.value.methods.map((value) => ({ kind: '方法', value, core: false })),
    ...(extracted.value.strategy?.goals || []).slice(0, 2).map((value) => ({ kind: '目标', value, core: true })),
    ...(extracted.value.strategy?.operations || []).slice(0, 3).map((value) => ({ kind: '操作', value, core: false })),
    ...extracted.value.structure.slice(0, 2).map((value) => ({ kind: '结构', value, core: false })),
  ]
})

watch(sampleKey, (value) => {
  if (!SIMILARITY_SAMPLES[value]) return
  query.value = SIMILARITY_SAMPLES[value].text
  resetResult()
})

watch(engine, () => {
  extractionCache = null
  resetResult()
})

watch(query, () => {
  extractionCache = null
  if (hasRun.value) resetResult()
})

function resetResult() {
  hasRun.value = false
  results.value = []
  extracted.value = null
  errorMessage.value = ''
  currentStep.value = -1
}

function apiSnapshot() {
  return {
    endpoint: apiConfig.endpoint.trim(),
    model: apiConfig.model.trim(),
    key: apiConfig.key.trim(),
    timeout: apiConfig.timeout,
  }
}

function applyProviderPreset(provider) {
  applySharedProviderPreset(provider)
  extractionCache = null
  apiStatus.value = { message: '已填入官方地址，请补充 API Key', tone: '' }
}

function cacheKey() {
  const configKey = engine.value === 'api' ? `${apiConfig.endpoint}|${apiConfig.model}` : 'local'
  const imageKey = imageInput.value?.id || 'no-image'
  return `${engine.value}|${configKey}|${imageKey}|${query.value.trim()}`
}

function chooseImage() {
  imageFileInput.value?.click()
}

async function prepareSelectedImage(file) {
  if (!file || imagePreparing.value) return
  imagePreparing.value = true
  imageError.value = ''
  try {
    const prepared = await prepareSimilarityImage(file)
    const sampleText = SIMILARITY_SAMPLES[sampleKey.value]?.text
    if (sampleText && query.value.trim() === sampleText.trim()) query.value = ''
    sampleKey.value = 'image-upload'
    imageInput.value = prepared
    imageConsent.value = false
    engine.value = 'api'
    extractionCache = null
    resetResult()
  } catch (error) {
    imageError.value = error.message || '图片处理失败，请重新选择'
  } finally {
    imagePreparing.value = false
    if (imageFileInput.value) imageFileInput.value.value = ''
  }
}

function handleImageSelected(event) {
  prepareSelectedImage(event.target.files?.[0])
}

function handleImageDrop(event) {
  imageDragActive.value = false
  prepareSelectedImage(event.dataTransfer?.files?.[0])
}

function removeImage() {
  imageInput.value = null
  imageConsent.value = false
  imageError.value = ''
  extractionCache = null
  resetResult()
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function checkApi() {
  testingApi.value = true
  apiStatus.value = { message: '正在连接…', tone: '' }
  try {
    await testFeatureApi(apiSnapshot())
    apiStatus.value = { message: '连接成功（仅验证短响应）', tone: 'success' }
  } catch (error) {
    apiStatus.value = { message: error.message || '连接失败', tone: 'error' }
  } finally {
    testingApi.value = false
  }
}

async function runRecommendation() {
  const normalizedQuery = query.value.trim()
  if (!canRunRecommendation.value) return

  loading.value = true
  hasRun.value = false
  errorMessage.value = ''
  currentStep.value = 0

  try {
    const key = cacheKey()
    let features
    if (extractionCache?.key === key) {
      features = structuredClone(extractionCache.value)
    } else if (engine.value === 'api') {
      features = await extractFeaturesWithApi(apiSnapshot(), normalizedQuery, imageInput.value)
    } else {
      features = extractLocalFeatures(normalizedQuery, currentSample.value)
    }

    extractionCache = { key, value: structuredClone(features) }
    extracted.value = features
    currentStep.value = 1
    await wait(120)
    currentStep.value = 2
    await wait(120)
    results.value = rankSimilarProblems(features, SIMILARITY_DEMO_CORPUS, mode.value).slice(0, 6)
    currentStep.value = 3
    await wait(120)
    hasRun.value = true
    if (engine.value === 'api') apiStatus.value = { message: '本次解析成功', tone: 'success' }
  } catch (error) {
    extracted.value = null
    results.value = []
    hasRun.value = true
    errorMessage.value = error.message || '推荐过程未完成，请检查设置后重试'
    if (engine.value === 'api') apiStatus.value = { message: errorMessage.value, tone: 'error' }
  } finally {
    loading.value = false
  }
}

async function rerank() {
  if (extracted.value && !loading.value) {
    results.value = rankSimilarProblems(extracted.value, SIMILARITY_DEMO_CORPUS, mode.value).slice(0, 6)
    hasRun.value = true
  }
}

function scorePercent(value) {
  return Math.round((Number(value) || 0) * 100)
}

function difficultyLabel(value) {
  if (value >= 0.8) return '挑战'
  if (value >= 0.65) return '较难'
  if (value >= 0.5) return '中等'
  return '基础'
}
</script>

<template>
  <div class="similarity-page">
    <header class="similarity-hero">
      <div class="similarity-hero-copy">
        <p class="similarity-eyebrow">MathSea · 智能检索实验室</p>
        <h1>相似题推荐</h1>
        <p>不只寻找题干相像的题，而是比较知识点、关键方法、解题策略与题型结构。</p>
      </div>
      <div class="similarity-version">
        <strong>测试版本</strong>
        <span>内置 12 道演示题</span>
      </div>
    </header>

    <main class="similarity-main">
      <form class="similarity-query-panel" @submit.prevent="runRecommendation">
        <div class="similarity-section-heading">
          <div>
            <span>01</span>
            <h2>输入题目</h2>
          </div>
          <p>粘贴题干，或者上传一道题的清晰图片。</p>
        </div>

        <label class="similarity-field">
          <span>示例题目</span>
          <select v-model="sampleKey">
            <option v-if="sampleKey === 'current-page'" value="current-page">来自当前题目</option>
            <option v-if="sampleKey === 'image-upload'" value="image-upload">来自上传图片</option>
            <option v-for="(sample, key) in SIMILARITY_SAMPLES" :key="key" :value="key">
              {{ sample.label }}
            </option>
          </select>
        </label>

        <label class="similarity-field">
          <span>{{ imageInput ? '补充说明（可选）' : '题干 / 知识点 / LaTeX' }} <small>{{ query.trim().length }} 字</small></span>
          <textarea
            v-model="query"
            rows="8"
            spellcheck="false"
            :placeholder="imageInput ? '例如：只识别印刷题干，忽略旁边的手写笔记' : '粘贴完整题干，或在下方上传图片'"
          ></textarea>
        </label>

        <section
          :class="['similarity-image-input', { 'is-dragging': imageDragActive, 'has-image': imageInput }]"
          @dragenter.prevent="imageDragActive = true"
          @dragover.prevent="imageDragActive = true"
          @dragleave.prevent="imageDragActive = false"
          @drop.prevent="handleImageDrop"
        >
          <input
            ref="imageFileInput"
            class="similarity-image-file"
            type="file"
            :accept="SIMILARITY_IMAGE_ACCEPT"
            aria-label="上传数学题图片"
            @change="handleImageSelected"
          />
          <template v-if="imageInput">
            <img :src="imageInput.dataUrl" alt="待识别的数学题图片" />
            <div class="similarity-image-copy">
              <strong>{{ imageInput.name }}</strong>
              <span>{{ imageInput.width }} × {{ imageInput.height }} · {{ formatImageBytes(imageInput.size) }}</span>
              <small>图片将在点击匹配后发送给你选择的多模态模型。</small>
              <label class="similarity-image-consent">
                <input v-model="imageConsent" type="checkbox" />
                我确认图片不含无关隐私，并允许发送给所选模型识别
              </label>
            </div>
            <div class="similarity-image-actions">
              <button type="button" @click="chooseImage">更换</button>
              <button type="button" @click="removeImage">移除</button>
            </div>
          </template>
          <template v-else>
            <div class="similarity-image-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><circle cx="9" cy="9" r="2"/><path d="m5 17 4-4 3 3 2-2 5 5"/></svg>
            </div>
            <div class="similarity-image-copy">
              <strong>{{ imagePreparing ? '正在处理图片…' : '上传题目图片' }}</strong>
              <span>支持 JPG、PNG、WebP，原图不超过 12 MB</span>
              <small>建议只保留题目区域，文字清晰、画面端正且无反光。</small>
            </div>
            <button type="button" :disabled="imagePreparing" @click="chooseImage">选择图片</button>
          </template>
        </section>
        <p v-if="imageError" class="similarity-image-error" role="alert">{{ imageError }}</p>

        <fieldset class="similarity-fieldset">
          <legend>特征解析方式</legend>
          <div class="similarity-segmented">
            <label :class="{ 'is-active': engine === 'local', 'is-disabled': imageInput }">
              <input v-model="engine" type="radio" value="local" :disabled="Boolean(imageInput)" />
              <strong>离线规则</strong>
              <span>{{ imageInput ? '暂不支持图片识别' : '不发送题干' }}</span>
            </label>
            <label :class="{ 'is-active': engine === 'api' }">
              <input v-model="engine" type="radio" value="api" />
              <strong>外部 API</strong>
              <span>{{ imageInput ? '识别图片并提取特征' : '提取策略特征' }}</span>
            </label>
          </div>
        </fieldset>

        <details class="similarity-api-settings" :open="engine === 'api'">
          <summary>API 设置</summary>
          <div class="similarity-api-body">
            <div class="similarity-provider-presets" aria-label="快速选择模型厂商">
              <button type="button" :disabled="Boolean(imageInput)" title="当前 DeepSeek 预设仅用于文字输入" @click="applyProviderPreset('deepseek')">DeepSeek</button>
              <button type="button" @click="applyProviderPreset('qwen')">Qwen 百炼</button>
              <button type="button" @click="applyProviderPreset('openai')">OpenAI</button>
            </div>
            <label class="similarity-field">
              <span>Chat Completions 地址 <small>由 MathSea 同源代理转发</small></span>
              <input v-model.trim="apiConfig.endpoint" type="url" placeholder="https://你的服务/v1/chat/completions" autocomplete="off" />
            </label>
            <div class="similarity-api-row">
              <label class="similarity-field">
                <span>模型名称</span>
                <input v-model.trim="apiConfig.model" type="text" placeholder="例如：gpt-4.1-mini" autocomplete="off" />
              </label>
              <label class="similarity-field">
                <span>超时（秒）</span>
                <input v-model.number="apiConfig.timeout" type="number" min="5" max="120" />
              </label>
            </div>
            <label class="similarity-field">
              <span>API Key <small>仅保存在当前页面内存</small></span>
              <input v-model="apiConfig.key" type="password" placeholder="填写对应厂商的 API Key" autocomplete="off" />
            </label>
            <div class="similarity-api-actions">
              <button type="button" :disabled="testingApi" @click="checkApi">
                {{ testingApi ? '连接中…' : '测试连接' }}
              </button>
              <span :class="apiStatus.tone" role="status">{{ apiStatus.message }}</span>
            </div>
            <details class="similarity-schema">
              <summary>查看模型输出约定</summary>
              <pre>{{ JSON.stringify(FEATURE_OUTPUT_SCHEMA, null, 2) }}</pre>
            </details>
            <p class="similarity-security-note">请求现由 MathSea 同源代理转发，不再受浏览器跨域限制。测试 Key 只存在页面内存与本次请求中；代理只允许 OpenAI、DeepSeek 和阿里云百炼的官方 HTTPS 地址。</p>
            <p class="similarity-security-note">“测试连接”只验证地址与 Key。完整题目解析会生成结构化特征，通常需要 20–90 秒；Qwen 预设允许最长等待 120 秒。</p>
            <p v-if="imageInput" class="similarity-security-note">图片模式需要支持视觉输入的模型。Qwen3.8-Flash 与 OpenAI GPT-4.1 Mini 预设可以接收图片；图片仅在本次识别请求中以压缩后的 Base64 数据发送。</p>
          </div>
        </details>

        <fieldset class="similarity-fieldset">
          <legend>这次想练什么？</legend>
          <div class="similarity-mode-grid">
            <label
              v-for="option in SIMILARITY_MODES"
              :key="option.value"
              :class="{ 'is-active': mode === option.value }"
            >
              <input v-model="mode" type="radio" :value="option.value" @change="rerank" />
              <strong>{{ option.label }}</strong>
              <span>{{ option.description }}</span>
            </label>
          </div>
        </fieldset>

        <button class="similarity-submit" type="submit" :disabled="!canRunRecommendation">
          {{ loading ? (imageInput ? '正在识别并建立相似坐标…' : '正在建立相似坐标…') : hasRun ? '重新匹配' : imageInput ? '识别图片并开始匹配' : '开始匹配' }}
        </button>
        <p v-if="imageInput && !imageConsent" class="similarity-consent-hint">勾选图片发送确认后才能开始匹配。</p>
        <p class="similarity-form-note">离线与 API 特征都会先映射到同一套标准标签；召回、负例惩罚、排序与质量门槛均在本页面执行。</p>
      </form>

      <section class="similarity-results" aria-labelledby="similarity-results-title">
        <header class="similarity-results-header">
          <div>
            <p>02</p>
            <h2 id="similarity-results-title">推荐结果</h2>
          </div>
          <span>{{ loading ? pipeline[currentStep] : hasRun ? '匹配完成' : '等待输入' }}</span>
        </header>

        <ol class="similarity-pipeline" aria-label="推荐流程">
          <li v-for="(step, index) in pipeline" :key="step" :class="{ 'is-active': index <= currentStep }">
            <span>{{ index + 1 }}</span>{{ step }}
          </li>
        </ol>

        <div v-if="extracted" class="similarity-analysis">
          <div class="similarity-analysis-head">
            <strong>已识别的检索意图</strong>
            <span>{{ extracted.source }} · 置信度 {{ scorePercent(extracted.confidence) }}%</span>
          </div>
          <div v-if="extracted.recognizedText" class="similarity-recognized-text">
            <strong>图片识别题干</strong>
            <p>{{ extracted.recognizedText }}</p>
          </div>
          <div class="similarity-chips">
            <span v-for="chip in featureChips" :key="`${chip.kind}-${chip.value}`" :class="{ 'is-core': chip.core }">
              {{ chip.kind }} · {{ chip.value }}
            </span>
          </div>
        </div>

        <div v-if="errorMessage" class="similarity-message is-error" role="alert">
          <strong>本次匹配未完成</strong>
          <p>{{ errorMessage }}</p>
          <small>系统没有自动改用离线结果，以免掩盖接口问题。</small>
        </div>

        <div v-else-if="!hasRun" class="similarity-empty">
          <div aria-hidden="true">∿</div>
          <h3>尚未开始匹配</h3>
          <p>建议依次体验“同知识点”“同方法”和“难度进阶”，比较推荐顺序如何变化。</p>
        </div>

        <template v-else>
          <div v-if="results.length" class="similarity-result-summary">
            <span>候选 {{ results.length }} 道</span>
            <strong :class="`is-${resultConfidence.tone}`">{{ resultConfidence.label }}</strong>
          </div>

          <div v-if="results.length" class="similarity-result-list">
            <article v-for="(problem, index) in results" :key="problem.id" class="similarity-result-card">
              <div class="similarity-rank">{{ String(index + 1).padStart(2, '0') }}</div>
              <div class="similarity-result-content">
                <p class="similarity-result-meta">{{ problem.id }} · {{ problem.year }} · {{ problem.sourceLabel }} · {{ problem.typeLabel }}</p>
                <h3>{{ problem.title }}</h3>
                <p class="similarity-result-detail">{{ problem.detail }}</p>
                <p class="similarity-reason">{{ problem.reason }}</p>
                <p v-if="problem.penalty" class="similarity-penalty">已触发负例惩罚 −{{ scorePercent(problem.penalty) }}：方法标签接近，但策略目标或关键操作不足。</p>
                <div class="similarity-result-tags">
                  <span v-for="tag in problem.knowledge" :key="tag">{{ tag }}</span>
                </div>
              </div>
              <div class="similarity-score">
                <strong>{{ scorePercent(problem.score) }}</strong>
                <span>匹配度</span>
                <small>{{ difficultyLabel(problem.difficulty) }}</small>
              </div>
              <details class="similarity-metrics">
                <summary>查看评分构成</summary>
                <dl>
                  <div v-for="(value, metric) in problem.metrics" :key="metric">
                    <dt>{{ { knowledge: '知识', method: '方法标签', strategy: '策略骨架', structure: '题型结构', semantic: '文本语义', difficulty: '难度适配', quality: '题目质量' }[metric] }}</dt>
                    <dd><span :style="{ width: `${scorePercent(value)}%` }"></span><b>{{ scorePercent(value) }}</b></dd>
                  </div>
                </dl>
              </details>
              <RouterLink class="similarity-corpus-link" :to="{ name: 'problems', query: { keyword: problem.knowledge[0] } }">
                在题库中继续搜索
              </RouterLink>
            </article>
          </div>

          <div v-else class="similarity-message">
            <strong>暂无可靠结果</strong>
            <p>没有候选题通过当前模式的质量门槛。正式系统不应使用低相关题目补满数量。</p>
          </div>
        </template>
      </section>
    </main>
  </div>
</template>
