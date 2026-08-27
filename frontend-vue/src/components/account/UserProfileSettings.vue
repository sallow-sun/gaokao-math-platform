<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { USER_PROFILE_PROTOTYPE } from '../../config/account.js'
import AccountAvatar from './AccountAvatar.vue'

const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

const avatarFileName = ref('尚未选择新头像')
const avatarMessage = ref('')
const avatarPreviewUrl = ref('')
const signature = ref('')
const signatureCount = computed(() => signature.value.length)

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
    avatarFileName.value = '尚未选择新头像'
    revokeAvatarPreview()
    return
  }

  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    input.value = ''
    avatarFileName.value = '尚未选择新头像'
    avatarMessage.value = '只支持 PNG、JPG、GIF 或 WEBP 图片。'
    revokeAvatarPreview()
    return
  }

  if (file.size > MAX_AVATAR_SIZE) {
    input.value = ''
    avatarFileName.value = '尚未选择新头像'
    avatarMessage.value = '头像文件不能超过 5MB。'
    revokeAvatarPreview()
    return
  }

  revokeAvatarPreview()
  avatarPreviewUrl.value = URL.createObjectURL(file)
  avatarFileName.value = file.name
  avatarMessage.value = '已生成本地预览，图片尚未上传。'
}

onBeforeUnmount(revokeAvatarPreview)
</script>

<template>
  <form class="account-settings-card" novalidate @submit.prevent>
    <header class="account-settings-card-header">
      <div>
        <p>PUBLIC PROFILE</p>
        <h2>个人设置</h2>
      </div>
      <span>头像与签名将在个人主页中公开展示。</span>
    </header>

    <section class="account-profile-setting-row" aria-labelledby="avatar-setting-title">
      <div class="account-setting-copy">
        <h3 id="avatar-setting-title">头像</h3>
        <p>支持 PNG、JPG、GIF、WEBP，文件不超过 5MB。</p>
      </div>

      <div class="account-avatar-setting-control">
        <AccountAvatar
          :avatar-url="avatarPreviewUrl || USER_PROFILE_PROTOTYPE.avatarUrl"
          :username="USER_PROFILE_PROTOTYPE.username"
        />
        <div>
          <label class="account-settings-file-button" for="settings-avatar-input"> 选择头像 </label>
          <input
            id="settings-avatar-input"
            class="account-settings-file-input"
            name="avatar"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            aria-describedby="settings-avatar-file-name settings-avatar-message"
            @change="handleAvatarChange"
          />
          <p id="settings-avatar-file-name" class="account-settings-file-name">
            {{ avatarFileName }}
          </p>
          <p id="settings-avatar-message" class="account-settings-field-message" role="status">
            {{ avatarMessage }}
          </p>
        </div>
      </div>
    </section>

    <section class="account-profile-setting-row" aria-labelledby="signature-setting-title">
      <div class="account-setting-copy">
        <h3 id="signature-setting-title">个人签名</h3>
        <p>用不超过 40 个字符介绍自己或记录当前目标。</p>
      </div>

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

    <footer class="account-settings-form-actions">
      <p id="profile-save-status">资料只用于当前页面预览，不会被保存或上传。</p>
      <button type="submit" disabled aria-describedby="profile-save-status">
        保存个人设置（待接入）
      </button>
    </footer>
  </form>
</template>
