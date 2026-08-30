<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_SIGNATURE_MAX_LENGTH,
  useProfileAppearance,
} from '../../composables/useProfileAppearance.js'
import AccountAvatar from './AccountAvatar.vue'

const props = defineProps({
  editable: {
    type: Boolean,
    default: false,
  },
  profile: {
    type: Object,
    required: true,
  },
})

const PROFILE_MESSAGE_DURATION = 4000

const avatarInput = ref(null)
const coverInput = ref(null)
const nameInput = ref(null)
const signatureInput = ref(null)
const appearanceMessage = ref('')
const isEditingName = ref(false)
const isEditingSignature = ref(false)
const nameDraft = ref('')
const signatureDraft = ref('')
let avatarRequestId = 0
let coverRequestId = 0
let appearanceMessageTimer = null

const {
  applyAvatarImage,
  applyCoverImage,
  avatarUrl,
  coverStyle,
  hasCoverImage,
  profileName,
  profileSignature,
  saveProfileName,
  saveProfileSignature,
} = useProfileAppearance()

const displayedAvatarUrl = computed(() => avatarUrl.value || props.profile.avatarUrl)
const displayedName = computed(() => profileName.value || props.profile.username)
const displayedSignature = computed(() => {
  if (profileSignature.value === null) {
    return props.profile.signature
  }

  return profileSignature.value || '还没有填写个人签名'
})

function setAppearanceMessage(message, autoDismiss = true) {
  if (appearanceMessageTimer) {
    window.clearTimeout(appearanceMessageTimer)
    appearanceMessageTimer = null
  }

  appearanceMessage.value = message

  if (!message || !autoDismiss) {
    return
  }

  appearanceMessageTimer = window.setTimeout(() => {
    appearanceMessage.value = ''
    appearanceMessageTimer = null
  }, PROFILE_MESSAGE_DURATION)
}

function openCoverPicker() {
  if (!coverInput.value) {
    return
  }

  coverInput.value.value = ''
  coverInput.value.click()
}

function openAvatarPicker() {
  if (!avatarInput.value) {
    return
  }

  avatarInput.value.value = ''
  avatarInput.value.click()
}

async function handleCoverChange(event) {
  const input = event.target
  const file = input.files?.[0]
  const requestId = ++coverRequestId

  if (!file) {
    return
  }

  setAppearanceMessage('正在应用并保存背景图片……', false)
  const result = await applyCoverImage(file)

  if (requestId !== coverRequestId) {
    return
  }

  setAppearanceMessage(result.message)

  if (!result.ok) {
    input.value = ''
  }
}

async function handleAvatarChange(event) {
  const input = event.target
  const file = input.files?.[0]
  const requestId = ++avatarRequestId

  if (!file) {
    return
  }

  setAppearanceMessage('正在应用并保存头像……', false)
  const result = await applyAvatarImage(file)

  if (requestId !== avatarRequestId) {
    return
  }

  setAppearanceMessage(result.message)

  if (!result.ok) {
    input.value = ''
  }
}

async function beginSignatureEditing() {
  signatureDraft.value = profileSignature.value ?? ''
  isEditingSignature.value = true
  await nextTick()
  signatureInput.value?.focus()
  signatureInput.value?.select()
}

async function beginNameEditing() {
  nameDraft.value = displayedName.value
  isEditingName.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function cancelNameEditing() {
  isEditingName.value = false
}

function handleNameSave() {
  const result = saveProfileName(nameDraft.value)
  setAppearanceMessage(result.message)

  if (result.ok) {
    isEditingName.value = false
  }
}

function cancelSignatureEditing() {
  isEditingSignature.value = false
}

function handleSignatureSave() {
  const result = saveProfileSignature(signatureDraft.value)
  setAppearanceMessage(result.message)
  isEditingSignature.value = false
}

onBeforeUnmount(() => {
  if (appearanceMessageTimer) {
    window.clearTimeout(appearanceMessageTimer)
  }
})
</script>

<template>
  <section class="account-profile-hero" :aria-label="`${displayedName}的个人主页`">
    <div
      class="account-profile-hero-body"
      :class="{ 'has-custom-cover': hasCoverImage }"
      :style="coverStyle"
    >
      <div v-if="editable" class="account-profile-cover-action">
        <button
          type="button"
          :aria-label="hasCoverImage ? '更换个人主页背景' : '设置个人主页背景'"
          aria-describedby="account-profile-edit-status"
          @click="openCoverPicker"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6.5h16v11H4z" />
            <path d="m6.5 15 3.4-3.4 2.7 2.6 1.8-1.7 3.1 2.5" />
            <circle cx="16.5" cy="9.5" r="1.2" />
          </svg>
        </button>
      </div>

      <p
        id="account-profile-edit-status"
        class="account-profile-edit-status"
        role="status"
        aria-live="polite"
      >
        {{ appearanceMessage }}
      </p>

      <div class="account-profile-identity-cluster">
        <div v-if="editable" class="account-profile-avatar-editor">
          <AccountAvatar :avatar-url="displayedAvatarUrl" :username="displayedName" />
          <button
            type="button"
            class="account-profile-avatar-edit-button"
            aria-label="更换头像"
            aria-describedby="account-profile-edit-status"
            @click="openAvatarPicker"
          >
            <span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" />
                <circle cx="12" cy="13.2" r="3.2" />
              </svg>
              更换
            </span>
          </button>
        </div>
        <AccountAvatar v-else :avatar-url="displayedAvatarUrl" :username="displayedName" />

        <div class="account-profile-identity">
          <div class="account-profile-name-row">
            <div v-if="editable && isEditingName" class="account-profile-name-editor">
              <label class="account-profile-visually-hidden" for="account-profile-name-input">
                用户名
              </label>
              <input
                id="account-profile-name-input"
                ref="nameInput"
                v-model="nameDraft"
                type="text"
                :maxlength="PROFILE_NAME_MAX_LENGTH"
                @keydown.esc.prevent="cancelNameEditing"
                @keydown.enter.prevent="handleNameSave"
              />
              <span>{{ nameDraft.length }}/{{ PROFILE_NAME_MAX_LENGTH }}</span>
              <button type="button" @click="cancelNameEditing">取消</button>
              <button type="button" class="is-primary" @click="handleNameSave">保存</button>
            </div>
            <h1 v-else id="account-profile-user-name">
              <button
                v-if="editable"
                type="button"
                class="account-profile-name-button"
                aria-label="修改用户名"
                @click="beginNameEditing"
              >
                <span>{{ displayedName }}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m4 16.5-.5 4 4-.5L19 8.5 15.5 5z" />
                  <path d="m13.8 6.7 3.5 3.5" />
                </svg>
              </button>
              <template v-else>{{ displayedName }}</template>
            </h1>
          </div>

          <div v-if="editable && isEditingSignature" class="account-profile-signature-editor">
            <label class="account-profile-visually-hidden" for="account-profile-signature-input">
              个人签名
            </label>
            <input
              id="account-profile-signature-input"
              ref="signatureInput"
              v-model="signatureDraft"
              type="text"
              :maxlength="PROFILE_SIGNATURE_MAX_LENGTH"
              @keydown.esc.prevent="cancelSignatureEditing"
              @keydown.enter.prevent="handleSignatureSave"
            />
            <div>
              <span>{{ signatureDraft.length }}/{{ PROFILE_SIGNATURE_MAX_LENGTH }}</span>
              <button type="button" @click="cancelSignatureEditing">取消</button>
              <button type="button" class="is-primary" @click="handleSignatureSave">保存</button>
            </div>
          </div>
          <button
            v-else-if="editable"
            type="button"
            class="account-profile-signature-button"
            aria-label="编辑个人签名"
            @click="beginSignatureEditing"
          >
            <span>{{ displayedSignature }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m4 16.5-.5 4 4-.5L19 8.5 15.5 5z" />
              <path d="m13.8 6.7 3.5 3.5" />
            </svg>
          </button>
          <p v-else class="account-profile-signature">{{ displayedSignature }}</p>

          <p class="account-profile-meta">
            <span>UID：{{ profile.uid }}</span>
            <span>注册时间：{{ profile.joinedAt }}</span>
          </p>
        </div>
      </div>

      <RouterLink
        v-if="editable"
        class="account-profile-settings-link"
        :to="{ name: 'user-settings-preferences' }"
        aria-label="进入个人设置"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <circle cx="17.5" cy="15.5" r="2" />
          <path d="M17.5 11.5v1M17.5 18.5v1M13.5 15.5h1M20.5 15.5h1" />
        </svg>
        <span>个人设置</span>
      </RouterLink>

      <input
        v-if="editable"
        id="account-profile-cover-input"
        ref="coverInput"
        class="account-profile-visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        aria-label="选择个人主页背景图片"
        aria-describedby="account-profile-edit-status"
        @change="handleCoverChange"
      />
      <input
        v-if="editable"
        id="account-profile-avatar-input"
        ref="avatarInput"
        class="account-profile-visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        aria-label="选择头像图片"
        aria-describedby="account-profile-edit-status"
        @change="handleAvatarChange"
      />
    </div>

    <div class="account-profile-tabs" role="tablist" aria-label="个人主页内容">
      <button
        id="account-profile-learning-tab"
        type="button"
        class="is-active"
        role="tab"
        aria-selected="true"
        aria-controls="account-profile-learning-panel"
      >
        学习统计
      </button>
      <button type="button" role="tab" aria-selected="false" aria-disabled="true" disabled>
        社区贡献
        <small>待接入</small>
      </button>
    </div>
  </section>
</template>
