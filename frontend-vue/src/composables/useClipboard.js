export function writeTextToClipboard(value) {
  const text = String(value ?? '')

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  ) {
    return navigator.clipboard.writeText(text)
  }

  if (typeof document === 'undefined') {
    return Promise.reject(new Error('clipboard unavailable'))
  }

  return new Promise((resolve, reject) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()

    try {
      const copied = document.execCommand('copy')
      textArea.remove()
      copied ? resolve() : reject(new Error('copy failed'))
    } catch (error) {
      textArea.remove()
      reject(error)
    }
  })
}
