import { Buffer } from 'node:buffer'

const MAX_BODY_BYTES = 4 * 1024 * 1024
const ALLOWED_EXACT_HOSTS = new Set([
  'api.openai.com',
  'api.deepseek.com',
  'dashscope.aliyuncs.com',
  'dashscope-intl.aliyuncs.com',
])
const IMAGE_DATA_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
]
const MAX_IMAGE_DATA_URL_LENGTH = 3_000_000

function validateEndpoint(rawEndpoint) {
  let endpoint
  try {
    endpoint = new URL(String(rawEndpoint ?? ''))
  } catch {
    throw new Error('API 地址格式不正确')
  }

  const hostname = endpoint.hostname.toLowerCase()
  const allowedHost =
    ALLOWED_EXACT_HOSTS.has(hostname) ||
    hostname.endsWith('.maas.aliyuncs.com')

  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || !allowedHost) {
    throw new Error('测试代理仅允许 OpenAI、DeepSeek 和阿里云百炼的 HTTPS 官方域名')
  }
  if (!endpoint.pathname.endsWith('/chat/completions')) {
    throw new Error('API 地址必须是完整的 /chat/completions 请求地址')
  }
  return endpoint
}

function readJsonRequest(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求内容过大'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('请求格式不正确'))
      }
    })
    request.on('error', reject)
  })
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 8) {
    throw new Error('消息内容不能为空')
  }
  messages.forEach((message) => {
    if (!['system', 'user', 'assistant'].includes(message?.role)) throw new Error('消息角色不正确')
    if (typeof message.content === 'string') {
      if (!message.content.trim() || message.content.length > 30_000) throw new Error('消息文本为空或过长')
      return
    }
    if (message.role !== 'user' || !Array.isArray(message.content) || !message.content.length || message.content.length > 4) {
      throw new Error('多模态消息格式不正确')
    }
    message.content.forEach((part) => {
      if (part?.type === 'text') {
        if (typeof part.text !== 'string' || !part.text.trim() || part.text.length > 30_000) {
          throw new Error('图片说明为空或过长')
        }
        return
      }
      const dataUrl = part?.image_url?.url
      if (
        part?.type !== 'image_url' ||
        typeof dataUrl !== 'string' ||
        !IMAGE_DATA_PREFIXES.some((prefix) => dataUrl.startsWith(prefix)) ||
        dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH
      ) {
        throw new Error('图片仅支持受限大小的 JPG、PNG 或 WebP 上传数据')
      }
    })
  })
}

function sendJson(response, status, body) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens) || 0
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens) || 0
  const totalTokens = Number(usage.total_tokens) || promptTokens + completionTokens
  return { promptTokens, completionTokens, totalTokens }
}

function readProviderRequestId(response) {
  return (
    response.headers.get('x-request-id') ||
    response.headers.get('x-dashscope-request-id') ||
    response.headers.get('request-id') ||
    ''
  )
}

function describeUpstreamError(error, endpoint) {
  if (error?.name === 'TimeoutError') return '模型服务响应超时，请检查网络或稍后重试'

  const code = error?.cause?.code
  const hostname = endpoint?.hostname || '模型厂商'
  if (code === 'EACCES' || code === 'EPERM') {
    return `本地开发服务没有访问 ${hostname} 的外网权限，请以允许外部 HTTPS 的方式重新启动开发服务`
  }
  if (code === 'ENOTFOUND') return `无法解析 ${hostname}，请检查 DNS 设置`
  if (code === 'ECONNREFUSED') return `${hostname} 拒绝了连接，请检查接口地址`
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `连接 ${hostname}:443 超时，请检查代理、VPN或防火墙；也可以改用当前网络可访问的模型厂商`
  }
  if (typeof code === 'string' && code.includes('CERT')) {
    return `无法验证 ${hostname} 的 HTTPS 证书，请检查系统时间、证书或网络代理`
  }
  if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
    return `本地开发服务无法连接 ${hostname}，请检查代理、VPN、防火墙或厂商服务状态`
  }
  return error?.message || '代理请求失败'
}

export function similarityDevProxyPlugin() {
  return {
    name: 'mathsea-similarity-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/__mathsea_similarity_proxy', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: { message: '仅支持 POST 请求' } })
          return
        }

        let endpoint
        let connectingUpstream = false
        const startedAt = Date.now()
        try {
          const body = await readJsonRequest(request)
          endpoint = validateEndpoint(body.endpoint)
          const model = String(body.model ?? '').trim()
          const apiKey = String(body.apiKey ?? '').trim()
          const messages = Array.isArray(body.messages) ? body.messages : []
          const maxTokens = Math.max(1, Math.min(4000, Number(body.maxTokens) || 900))
          const timeoutSeconds = Math.max(5, Math.min(120, Number(body.timeoutSeconds) || 30))

          if (!model) throw new Error('请填写模型名称')
          if (!apiKey) throw new Error('请填写 API Key')
          validateMessages(messages)

          const upstreamBody = {
            model,
            messages,
            temperature: 0,
            max_tokens: maxTokens,
          }
          if (body.jsonMode) upstreamBody.response_format = { type: 'json_object' }
          if (body.lowLatency && endpoint.hostname === 'api.deepseek.com') {
            upstreamBody.thinking = { type: 'disabled' }
          } else if (
            body.lowLatency &&
            (endpoint.hostname.endsWith('.aliyuncs.com') || endpoint.hostname.endsWith('.maas.aliyuncs.com'))
          ) {
            upstreamBody.reasoning_effort = 'minimal'
          }

          connectingUpstream = true
          const upstream = await fetch(endpoint, {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(timeoutSeconds * 1000),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(upstreamBody),
          })
          const raw = await upstream.text()
          let data
          try {
            data = JSON.parse(raw)
          } catch {
            throw new Error(`模型服务返回了无法解析的内容（HTTP ${upstream.status}）`)
          }
          if (!upstream.ok) {
            const upstreamMessage = data?.error?.message || `模型服务请求失败（HTTP ${upstream.status}）`
            sendJson(response, 502, { error: { message: upstreamMessage } })
            return
          }
          const content = data?.choices?.[0]?.message?.content
          if (!content) throw new Error('模型服务未返回 choices[0].message.content')
          sendJson(response, 200, {
            content,
            model: data?.model || model,
            usage: normalizeUsage(data?.usage),
            providerRequestId: readProviderRequestId(upstream),
            elapsedMs: Date.now() - startedAt,
          })
        } catch (error) {
          const timeout = error?.name === 'TimeoutError'
          sendJson(response, timeout ? 504 : connectingUpstream ? 502 : 400, {
            error: { message: describeUpstreamError(error, endpoint) },
          })
        }
      })
    },
  }
}
