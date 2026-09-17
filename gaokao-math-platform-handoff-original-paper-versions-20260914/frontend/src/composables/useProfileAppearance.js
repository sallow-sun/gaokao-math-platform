import { computed, ref } from 'vue'

const PROFILE_COVER_STORAGE_KEY = 'mathverse-profile-cover'
const PROFILE_NAME_STORAGE_KEY = 'mathverse-profile-name'
const PROFILE_SIGNATURE_STORAGE_KEY = 'mathverse-profile-signature'
const PROFILE_DATABASE_NAME = 'mathverse-profile'
const PROFILE_DATABASE_VERSION = 1
const PROFILE_STORE_NAME = 'appearance'
const PROFILE_COVER_RECORD_KEY = 'cover-image'
const PROFILE_AVATAR_RECORD_KEY = 'avatar-image'
const ALLOWED_COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif']
const ALLOWED_COVER_FILE_PATTERN = /\.(?:avif|jpe?g|png|webp)$/i
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const ALLOWED_AVATAR_FILE_PATTERN = /\.(?:gif|jpe?g|png|webp)$/i
const MAX_COVER_SIZE = 5 * 1024 * 1024
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
export const PROFILE_NAME_MAX_LENGTH = 10
export const PROFILE_SIGNATURE_MAX_LENGTH = 16

const coverImage = ref('')
const avatarImage = ref('')
const profileName = ref(null)
const profileSignature = ref(null)
let coverObjectUrl = ''
let avatarObjectUrl = ''
let coverRevision = 0
let avatarRevision = 0
let storedCoverPromise = null
let storedAvatarPromise = null
let nameLoaded = false
let signatureLoaded = false
let coverMutationQueue = Promise.resolve()
let avatarMutationQueue = Promise.resolve()

function isAllowedCoverFile(file) {
  return (
    ALLOWED_COVER_TYPES.includes(file.type) ||
    (!file.type && ALLOWED_COVER_FILE_PATTERN.test(file.name))
  )
}

function isAllowedAvatarFile(file) {
  return (
    ALLOWED_AVATAR_TYPES.includes(file.type) ||
    (!file.type && ALLOWED_AVATAR_FILE_PATTERN.test(file.name))
  )
}

function replaceCoverPreview(source, isObjectUrl = false) {
  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl)
  }

  coverObjectUrl = isObjectUrl ? source : ''
  coverImage.value = source
}

function replaceAvatarPreview(source, isObjectUrl = false) {
  if (avatarObjectUrl) {
    URL.revokeObjectURL(avatarObjectUrl)
  }

  avatarObjectUrl = isObjectUrl ? source : ''
  avatarImage.value = source
}

function readLegacyCover() {
  try {
    const savedCover = window.localStorage.getItem(PROFILE_COVER_STORAGE_KEY) || ''
    return savedCover.startsWith('data:image/') ? savedCover : ''
  } catch {
    return ''
  }
}

function removeLegacyCover() {
  try {
    window.localStorage.removeItem(PROFILE_COVER_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

function loadStoredSignature() {
  if (signatureLoaded || typeof window === 'undefined') {
    return
  }

  signatureLoaded = true

  try {
    const savedSignature = window.localStorage.getItem(PROFILE_SIGNATURE_STORAGE_KEY)

    profileSignature.value =
      savedSignature === null ? null : savedSignature.slice(0, PROFILE_SIGNATURE_MAX_LENGTH)
  } catch {
    profileSignature.value = null
  }
}

function loadStoredName() {
  if (nameLoaded || typeof window === 'undefined') {
    return
  }

  nameLoaded = true

  try {
    const savedName = window.localStorage.getItem(PROFILE_NAME_STORAGE_KEY)?.trim()
    profileName.value = savedName ? savedName.slice(0, PROFILE_NAME_MAX_LENGTH) : null
  } catch {
    profileName.value = null
  }
}

function openProfileDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is unavailable'))
      return
    }

    const request = window.indexedDB.open(PROFILE_DATABASE_NAME, PROFILE_DATABASE_VERSION)

    request.addEventListener('upgradeneeded', () => {
      const database = request.result

      if (!database.objectStoreNames.contains(PROFILE_STORE_NAME)) {
        database.createObjectStore(PROFILE_STORE_NAME)
      }
    })

    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
    request.addEventListener('blocked', () => reject(new Error('IndexedDB upgrade was blocked')))
  })
}

async function runAppearanceStoreRequest(mode, operation) {
  const database = await openProfileDatabase()

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(PROFILE_STORE_NAME, mode)
      const store = transaction.objectStore(PROFILE_STORE_NAME)
      const request = operation(store)

      request.addEventListener('success', () => resolve(request.result))
      request.addEventListener('error', () => reject(request.error))
      transaction.addEventListener('abort', () => reject(transaction.error))
    })
  } finally {
    database.close()
  }
}

function readStoredCoverBlob() {
  return runAppearanceStoreRequest('readonly', (store) => store.get(PROFILE_COVER_RECORD_KEY))
}

function saveCoverBlob(file) {
  return runAppearanceStoreRequest('readwrite', (store) =>
    store.put(file, PROFILE_COVER_RECORD_KEY),
  )
}

function removeStoredCoverBlob() {
  return runAppearanceStoreRequest('readwrite', (store) => store.delete(PROFILE_COVER_RECORD_KEY))
}

function readStoredAvatarBlob() {
  return runAppearanceStoreRequest('readonly', (store) => store.get(PROFILE_AVATAR_RECORD_KEY))
}

function saveAvatarBlob(file) {
  return runAppearanceStoreRequest('readwrite', (store) =>
    store.put(file, PROFILE_AVATAR_RECORD_KEY),
  )
}

function removeStoredAvatarBlob() {
  return runAppearanceStoreRequest('readwrite', (store) => store.delete(PROFILE_AVATAR_RECORD_KEY))
}

function enqueueCoverMutation(operation) {
  const mutation = coverMutationQueue.then(operation, operation)
  coverMutationQueue = mutation.catch(() => {})
  return mutation
}

function enqueueAvatarMutation(operation) {
  const mutation = avatarMutationQueue.then(operation, operation)
  avatarMutationQueue = mutation.catch(() => {})
  return mutation
}

async function loadStoredCover() {
  if (storedCoverPromise || typeof window === 'undefined') {
    return storedCoverPromise
  }

  const loadRevision = coverRevision

  storedCoverPromise = (async () => {
    try {
      const storedCover = await readStoredCoverBlob()

      if (storedCover instanceof Blob && storedCover.type.startsWith('image/')) {
        if (loadRevision === coverRevision) {
          replaceCoverPreview(URL.createObjectURL(storedCover), true)
        }
        return
      }
    } catch {
      // Fall back to the legacy localStorage value below.
    }

    const legacyCover = readLegacyCover()

    if (legacyCover && loadRevision === coverRevision) {
      replaceCoverPreview(legacyCover)
    }
  })()

  return storedCoverPromise
}

async function loadStoredAvatar() {
  if (storedAvatarPromise || typeof window === 'undefined') {
    return storedAvatarPromise
  }

  const loadRevision = avatarRevision

  storedAvatarPromise = (async () => {
    try {
      const storedAvatar = await readStoredAvatarBlob()

      if (storedAvatar instanceof Blob && storedAvatar.type.startsWith('image/')) {
        if (loadRevision === avatarRevision) {
          replaceAvatarPreview(URL.createObjectURL(storedAvatar), true)
        }
      }
    } catch {
      // Keep the prototype avatar when IndexedDB is unavailable.
    }
  })()

  return storedAvatarPromise
}

export function useProfileAppearance() {
  void loadStoredCover()
  void loadStoredAvatar()
  loadStoredName()
  loadStoredSignature()

  const hasCoverImage = computed(() => Boolean(coverImage.value))
  const hasAvatarImage = computed(() => Boolean(avatarImage.value))
  const coverStyle = computed(() => ({
    '--profile-cover-image': hasCoverImage.value ? `url("${coverImage.value}")` : 'none',
  }))

  async function applyCoverImage(file) {
    if (!file || !isAllowedCoverFile(file)) {
      return { ok: false, message: '只支持 PNG、JPG、WEBP 或 AVIF 图片。' }
    }

    if (file.size > MAX_COVER_SIZE) {
      return { ok: false, message: '背景图片不能超过 5MB。' }
    }

    coverRevision += 1
    replaceCoverPreview(URL.createObjectURL(file), true)

    try {
      await enqueueCoverMutation(async () => {
        await saveCoverBlob(file)
        removeLegacyCover()
      })
      return { ok: true, message: '背景图片已应用，并保存在当前浏览器。' }
    } catch {
      return {
        ok: true,
        message: '背景图片已应用，但浏览器无法长期保存这张图片。',
      }
    }
  }

  async function clearCoverImage() {
    coverRevision += 1
    replaceCoverPreview('')
    const legacyCleared = removeLegacyCover()

    try {
      await enqueueCoverMutation(removeStoredCoverBlob)
      return legacyCleared ? '已恢复默认背景。' : '已恢复默认背景，但浏览器中的旧设置可能无法清除。'
    } catch {
      return '已恢复默认背景，但浏览器中的旧设置可能无法清除。'
    }
  }

  async function applyAvatarImage(file) {
    if (!file || !isAllowedAvatarFile(file)) {
      return { ok: false, message: '只支持 PNG、JPG、GIF 或 WEBP 图片。' }
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return { ok: false, message: '头像图片不能超过 5MB。' }
    }

    avatarRevision += 1
    replaceAvatarPreview(URL.createObjectURL(file), true)

    try {
      await enqueueAvatarMutation(() => saveAvatarBlob(file))
      return { ok: true, message: '头像已更新，并保存在当前浏览器。' }
    } catch {
      return {
        ok: true,
        message: '头像已更新，但浏览器无法长期保存这张图片。',
      }
    }
  }

  async function clearAvatarImage() {
    avatarRevision += 1
    replaceAvatarPreview('')

    try {
      await enqueueAvatarMutation(removeStoredAvatarBlob)
      return '已恢复默认头像。'
    } catch {
      return '已恢复默认头像，但浏览器中的旧头像可能无法清除。'
    }
  }

  function saveProfileSignature(value) {
    const normalizedSignature = String(value ?? '')
      .trim()
      .slice(0, PROFILE_SIGNATURE_MAX_LENGTH)
    profileSignature.value = normalizedSignature

    if (typeof window === 'undefined') {
      return { ok: true, message: '个人签名已更新。' }
    }

    try {
      window.localStorage.setItem(PROFILE_SIGNATURE_STORAGE_KEY, normalizedSignature)
      return { ok: true, message: '个人签名已更新，并保存在当前浏览器。' }
    } catch {
      return { ok: true, message: '个人签名已更新，但浏览器无法长期保存。' }
    }
  }

  function saveProfileName(value) {
    const normalizedName = String(value ?? '')
      .trim()
      .slice(0, PROFILE_NAME_MAX_LENGTH)

    if (!normalizedName) {
      return { ok: false, message: '用户名不能为空。' }
    }

    profileName.value = normalizedName

    if (typeof window === 'undefined') {
      return { ok: true, message: '用户名已更新。' }
    }

    try {
      window.localStorage.setItem(PROFILE_NAME_STORAGE_KEY, normalizedName)
      return { ok: true, message: '用户名已更新，并保存在当前浏览器。' }
    } catch {
      return { ok: true, message: '用户名已更新，但浏览器无法长期保存。' }
    }
  }

  return {
    applyAvatarImage,
    applyCoverImage,
    avatarUrl: avatarImage,
    clearAvatarImage,
    clearCoverImage,
    coverStyle,
    hasAvatarImage,
    hasCoverImage,
    profileName,
    profileSignature,
    saveProfileName,
    saveProfileSignature,
  }
}
