import { computed, onMounted, ref } from 'vue'
import { HOME_BACKGROUND_MAX_FILE_SIZE, HOME_BACKGROUND_OPTIONS } from '../config/home'

const STORAGE_KEYS = {
  background: 'mathverse-home-background',
  lastRandomProblem: 'mathverse-home-last-random-problem',
}

const CUSTOM_BACKGROUND_ID = 'custom'
const DEFAULT_BACKGROUND_ID = HOME_BACKGROUND_OPTIONS[0].id

function readSetting(key) {
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function saveSetting(key, value) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function getBackgroundOption(backgroundId) {
  return HOME_BACKGROUND_OPTIONS.find(({ id }) => id === backgroundId)
}

export function useHomePreferences() {
  const backgroundId = ref(DEFAULT_BACKGROUND_ID)
  const customBackgroundImage = ref('')
  const statusMessage = ref('')

  const selectedBackground = computed(() => getBackgroundOption(backgroundId.value))
  const backgroundImage = computed(() => {
    if (backgroundId.value === CUSTOM_BACKGROUND_ID) {
      return customBackgroundImage.value ? `url("${customBackgroundImage.value}")` : 'none'
    }

    return selectedBackground.value?.image ?? 'none'
  })
  const hasBackground = computed(() => backgroundImage.value !== 'none')
  const backgroundStyle = computed(() => ({
    '--home-background-image': backgroundImage.value,
  }))

  function announce(message) {
    statusMessage.value = message
  }

  function applyPresetBackground(nextBackgroundId) {
    const option = getBackgroundOption(nextBackgroundId)

    if (!option) {
      announce('未能应用所选系统背景')
      return false
    }

    backgroundId.value = option.id
    customBackgroundImage.value = ''
    const isSaved = saveSetting(STORAGE_KEYS.background, `preset:${option.id}`)
    announce(isSaved ? `已应用“${option.name}”` : `已应用“${option.name}”，但浏览器无法保存此设置`)
    return true
  }

  function applyBackground(file) {
    if (!file || !file.type.startsWith('image/')) {
      announce('上传失败：请选择有效的图片文件')
      return false
    }

    if (file.size > HOME_BACKGROUND_MAX_FILE_SIZE) {
      announce('图片过大，上传失败。请选择不超过 2 MB 的图片')
      return false
    }

    announce('正在读取背景图片…')
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      const imageData = typeof reader.result === 'string' ? reader.result : ''

      if (!imageData) {
        announce('上传失败：未能读取所选背景图片')
        return
      }

      backgroundId.value = CUSTOM_BACKGROUND_ID
      customBackgroundImage.value = imageData
      const isSaved = saveSetting(STORAGE_KEYS.background, imageData)
      announce(isSaved ? '自定义背景已应用' : '背景已应用，但浏览器无法长期保存这张图片')
    })

    reader.addEventListener('error', () => {
      announce('上传失败：未能读取所选背景图片')
    })

    reader.readAsDataURL(file)
    return true
  }

  function pickRandomProblem(problemIds) {
    const validIds = problemIds.map((id) => id.trim()).filter(Boolean)

    if (!validIds.length) {
      return ''
    }

    const lastProblemId = readSetting(STORAGE_KEYS.lastRandomProblem)
    const availableIds =
      validIds.length > 1 ? validIds.filter((id) => id !== lastProblemId) : validIds
    const problemId = availableIds[Math.floor(Math.random() * availableIds.length)]

    saveSetting(STORAGE_KEYS.lastRandomProblem, problemId)
    return problemId
  }

  onMounted(() => {
    const savedBackground = readSetting(STORAGE_KEYS.background)

    if (savedBackground.startsWith('data:image/')) {
      backgroundId.value = CUSTOM_BACKGROUND_ID
      customBackgroundImage.value = savedBackground
      return
    }

    if (savedBackground.startsWith('preset:')) {
      const savedBackgroundId = savedBackground.slice('preset:'.length)
      if (getBackgroundOption(savedBackgroundId)) {
        backgroundId.value = savedBackgroundId
      }
    }
  })

  return {
    backgroundId,
    hasBackground,
    backgroundStyle,
    statusMessage,
    announce,
    applyPresetBackground,
    applyBackground,
    pickRandomProblem,
  }
}
