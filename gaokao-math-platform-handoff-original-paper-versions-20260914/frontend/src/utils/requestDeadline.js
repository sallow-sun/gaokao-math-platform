export async function requestDeadline(action, milliseconds = 8000, signal) {
  const controller = new AbortController()
  let timer
  let abort
  const interruption = new Promise((_, reject) => {
    abort = () => {
      controller.abort()
      reject(new Error('加载已取消，请重试'))
    }
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('加载超时，请重试'))
    }, milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
  try {
    return await Promise.race([
      interruption,
      Promise.resolve().then(() => action(controller.signal)),
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
