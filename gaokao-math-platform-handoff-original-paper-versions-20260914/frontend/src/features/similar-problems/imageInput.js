export const SIMILARITY_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const SIMILARITY_IMAGE_MAX_SOURCE_BYTES = 12 * 1024 * 1024
export const SIMILARITY_IMAGE_MAX_DATA_BYTES = 2 * 1024 * 1024

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_EDGE = 1800

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result || '')))
    reader.addEventListener('error', () => reject(new Error('图片读取失败，请重新选择')))
    reader.readAsDataURL(blob)
  })
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('无法解析图片，请改用 JPG、PNG 或 WebP')))
    image.src = url
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('图片压缩失败，请更换图片后重试')),
      'image/jpeg',
      quality,
    )
  })
}

export async function prepareSimilarityImage(file) {
  if (!(file instanceof Blob)) throw new Error('请选择图片文件')
  if (!SUPPORTED_TYPES.has(file.type)) throw new Error('仅支持 JPG、PNG 和 WebP 图片')
  if (!file.size) throw new Error('图片文件为空')
  if (file.size > SIMILARITY_IMAGE_MAX_SOURCE_BYTES) throw new Error('原图不能超过 12 MB')

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    let outputBlob = file

    if (scale < 1 || file.size > SIMILARITY_IMAGE_MAX_DATA_BYTES) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('当前浏览器无法处理图片')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      for (const quality of [0.92, 0.84, 0.76, 0.68]) {
        outputBlob = await canvasToBlob(canvas, quality)
        if (outputBlob.size <= SIMILARITY_IMAGE_MAX_DATA_BYTES) break
      }
    }

    if (outputBlob.size > SIMILARITY_IMAGE_MAX_DATA_BYTES) {
      throw new Error('压缩后的图片仍超过 2 MB，请裁剪题目区域后重试')
    }

    const dataUrl = await readAsDataUrl(outputBlob)
    return {
      id: `${file.name || 'image'}:${file.size}:${file.lastModified || 0}:${outputBlob.size}`,
      name: file.name || '数学题图片',
      dataUrl,
      mime: outputBlob.type || file.type,
      size: outputBlob.size,
      originalSize: file.size,
      width,
      height,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function formatImageBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
