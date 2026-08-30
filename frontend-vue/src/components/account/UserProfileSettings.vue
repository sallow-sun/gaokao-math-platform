<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useProfileAppearance } from '../../composables/useProfileAppearance.js'
import { USER_PROFILE_PROTOTYPE } from '../../config/account.js'
import UserProfilePreview from './UserProfilePreview.vue'

const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const ALLOWED_AVATAR_FILE_PATTERN = /\.(?:gif|jpe?g|png|webp)$/i
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

const avatarInput = ref(null)
const avatarFileName = ref('')
const avatarMessage = ref('')
const avatarPreviewUrl = ref('')
const coverInput = ref(null)
const coverFileName = ref('')
const coverMessage = ref('')
const signature = ref('')
const signatureCount = computed(() => signature.value.length)
const { applyCoverImage, clearCoverImage, coverStyle, hasCoverImage } = useProfileAppearance()
let coverRequestId = 0

function isAllowedAvatarFile(file) {
  return (
    ALLOWED_AVATAR_TYPES.includes(file.type) ||
    (!file.type && ALLOWED_AVATAR_FILE_PATTERN.test(file.name))
  )
}

function revokeAvatarPreview() {
  if (!avatarPreviewUrl.value) {
    return
  }

  URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarPreviewUrl.value = ''
}

function handleAvatarChange(event) {
  const input = event.target
  const file = input.files?.[0]

  avatarMessage.value = ''

  if (!file) {
    avatarFileName.value = ''
    revokeAvatarPreview()
    return
  }

  if (!isAllowedAvatarFile(file)) {
    input.value = ''
    avatarFileName.value = ''
    avatarMessage.value = '只支持 PNG、JPG、GIF 或 WEBP 图片。'
    revokeAvatarPreview()
    return
  }

  if (file.size > MAX_AVATAR_SIZE) {
    input.value = ''
    avatarFileName.value = ''
    avatarMessage.value = '头像文件不能超过 5MB。'
    revokeAvatarPreview()
    return
  }

  revokeAvatarPreview()
  avatarPreviewUrl.value = URL.createObjectURL(file)
  avatarFileName.value = file.name
  avatarMessage.value = '已生成本地预览，图片尚未上传。'
}

function handleAvatarClear() {
  if (avatarInput.value) {
    avatarInput.value.value = ''
  }

  avatarFileName.value = ''
  avatarMessage.value = '已恢复默认头像预览。'
  revokeAvatarPreview()
}

async function handleCoverChange(event) {
  const input = event.target
  const file = input.files?.[0]
  const requestId = ++coverRequestId

  if (!file) {
    return
  }

  coverMessage.value = '正在应用并保存背景图片……'
  const result = await applyCoverImage(file)

  if (requestId !== coverRequestId) {
    return
  }

  coverMessage.value = result.message

  if (result.ok) {
    coverFileName.value = file.name
    return
  }

  input.value = ''
  coverFileName.value = ''
}

async function handleCoverClear() {
  const requestId = ++coverRequestId

  if (coverInput.value) {
    coverInput.value.value = ''
  }

  coverFileName.value = ''
  coverMessage.value = '正在恢复默认背景……'
  const message = await clearCoverImage()

  if (requestId === coverRequestId) {
    coverMessage.value = message
  }
}

onBeforeUnmount(revokeAvatarPreview)
</script>

<template>
  <section
    class="account-settings-card account-profile-editor"
    aria-labelledby="profile-editor-title"
  >
    <header class="account-settings-card-header">
      <div>
        <h2 id="profile-editor-title">公开资料</h2>
      </div>
      <span>调整个人主页中公开展示的背景、头像和签名。</span>
    </header>

    <div class="account-profile-editor-layout">
      <div class="account-profile-editor-fields">
        <section class="account-profile-editor-section" aria-labelledby="cover-setting-title">
          <header>
            <h3 id="cover-setting-title">主页背景</h3>
            <p>建议使用横向图片。支持 PNG、JPG、WEBP、AVIF，文件不超过 5MB。</p>
          </header>

          <div class="account-profile-editor-control">
            <div class="account-profile-editor-actions">
              <label class="account-settings-file-button" for="settings-cover-input">
                选择背景图片
              </label>
              <input
                id="settings-cover-input"
                ref="coverInput"
                class="account-settings-file-input"
                name="profile-cover"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                aria-describedby="settings-cover-file-name settings-cover-message"
                @change="handleCoverChange"
              />
              <button
                type="button"
                class="account-settings-secondary-button"
                :disabled="!hasCoverImage"
                @click="handleCoverClear"
              >
                恢复默认
              </button>
            </div>
            <div class="account-profile-editor-feedback" role="status" aria-live="polite">
              <p id="settings-cover-file-name" class="account-settings-file-name">
                {{ coverFileName ? `已选择：${coverFileName}` : '' }}
              </p>
              <p id="settings-cover-message" class="account-settings-field-message">
                {{ coverMessage }}
              </p>
            </div>
          </div>
        </section>

        <section class="account-profile-editor-section" aria-labelledby="avatar-setting-title">
          <header>
            <h3 id="avatar-setting-title">头像</h3>
            <p>支持 PNG、JPG、GIF、WEBP，文件不超过 5MB。</p>
          </header>

          <div class="account-profile-editor-control">
            <div class="account-profile-editor-actions">
              <label class="account-settings-file-button" for="settings-avatar-input">
                选择头像
              </label>
              <input
                id="settings-avatar-input"
                ref="avatarInput"
                class="account-settings-file-input"
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                aria-describedby="settings-avatar-file-name settings-avatar-message"
                @change="handleAvatarChange"
              />
              <button
                type="button"
                class="account-settings-secondary-button"
                :disabled="!avatarPreviewUrl"
                @click="handleAvatarClear"
              >
                恢复默认
              </button>
            </div>
            <div class="account-profile-editor-feedback" role="status" aria-live="polite">
              <p id="settings-avatar-file-name" class="account-settings-file-name">
                {{ avatarFileName ? `已选择：${avatarFileName}` : '' }}
              </p>
              <p id="settings-avatar-message" class="account-settings-field-message">
                {{ avatarMessage }}
              </p>
            </div>
          </div>
        </section>

        <section class="account-profile-editor-section" aria-labelledby="signature-setting-title">
          <header>
            <h3 id="signature-setting-title">个人签名</h3>
            <p>用不超过 40 个字符介绍自己或记录当前目标。</p>
          </header>

          <div class="account-signature-control">
            <textarea
              id="settings-signature"
              v-model="signature"
              name="signature"
              maxlength="40"
              rows="4"
              placeholder="介绍一下自己，或者写下你正在努力的方向……"
              aria-describedby="settings-signature-count"
            />
            <p id="settings-signature-count">{{ signatureCount }}/40</p>
          </div>
        </section>
      </div>

      <UserProfilePreview
        :avatar-url="avatarPreviewUrl || USER_PROFILE_PROTOTYPE.avatarUrl"
        :cover-style="coverStyle"
        :has-cover-image="hasCoverImage"
        :profile="USER_PROFILE_PROTOTYPE"
        :signature="signature"
      />
    </div>

    <footer class="account-profile-editor-status" aria-label="资料保存范围">
      <div>
        <strong>主页背景</strong>
        <span>选择后自动保存到当前浏览器</span>
      </div>
      <div>
        <strong>头像与签名</strong>
        <span>仅用于本页预览，不会保存或上传</span>
      </div>
    </footer>
  </section>
</template>
