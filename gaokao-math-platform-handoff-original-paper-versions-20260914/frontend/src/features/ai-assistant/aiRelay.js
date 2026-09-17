import { apiRequest } from '../../services/apiClient.js'
import { recordAiCall } from './aiProviderStore.js'

export function validateAiConfig(config) {
  if (!config.endpoint) throw new Error('请填写 Chat Completions 地址')
  if (!/^https?:\/\//i.test(config.endpoint)) throw new Error('API 地址必须以 http:// 或 https:// 开头')
  if (!config.model) throw new Error('请填写模型名称')
  if (!config.key) throw new Error('请填写 API Key')
}

async function readRelayResponse(response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || `代理请求失败（HTTP ${response.status}）`)
  return body
}

export async function callAi({
  config,
  messages,
  taskType = 'chat',
  maxTokens = 900,
  jsonMode = false,
  lowLatency = false,
  signal,
}) {
  validateAiConfig(config)
  const timeoutSeconds = Math.max(5, Math.min(120, Number(config.timeout) || 30))
  const controller = new AbortController()
  const requestSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal
  const startedAt = performance.now()
  const timer = window.setTimeout(() => controller.abort(), (timeoutSeconds + 3) * 1000)
  const payload = {
    taskType,
    endpoint: config.endpoint,
    model: config.model,
    apiKey: config.key,
    messages,
    maxTokens,
    timeoutSeconds,
    jsonMode,
    lowLatency,
  }

  try {
    const data = import.meta.env.DEV
      ? await fetch('/__mathsea_similarity_proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: requestSignal,
          body: JSON.stringify(payload),
        }).then(readRelayResponse)
      : await apiRequest('/api/v1/ai/similarity/chat', {
          method: 'POST',
          body: payload,
          signal: requestSignal,
        })
    if (!data?.content) throw new Error('代理未返回模型内容')

    const result = {
      content: data.content,
      model: data.model || config.model,
      usage: data.usage || null,
      providerRequestId: data.providerRequestId || '',
      elapsedMs: data.elapsedMs || Math.round(performance.now() - startedAt),
      cached: false,
      taskType,
    }
    recordAiCall({ status: 'success', ...result })
    return result
  } catch (error) {
    let normalizedError = error
    if (error.name === 'AbortError') {
      normalizedError = signal?.aborted
        ? new Error('请求已停止', { cause: error })
        : new Error(`请求超过 ${timeoutSeconds} 秒`, { cause: error })
    }
    else if (/Failed to fetch/i.test(error.message)) {
      normalizedError = new Error('无法连接 MathSea 模型代理，请确认本地开发服务或后端已经启动', { cause: error })
    } else if (/模型服务响应超时/.test(error.message)) {
      normalizedError = new Error(`模型在 ${timeoutSeconds} 秒内未完成解析，请提高超时时间或改用更快的模型`, { cause: error })
    }
    recordAiCall({
      status: 'error',
      taskType,
      model: config.model,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: normalizedError.message,
      cached: false,
    })
    throw normalizedError
  } finally {
    window.clearTimeout(timer)
  }
}

export async function testAiConnection(config) {
  return callAi({
    config,
    taskType: 'connection-test',
    maxTokens: 12,
    lowLatency: true,
    messages: [{ role: 'user', content: '只回复 OK，用于连接测试。' }],
  })
}
