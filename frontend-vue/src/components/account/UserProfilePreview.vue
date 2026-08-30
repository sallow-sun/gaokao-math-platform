<script setup>
import { computed } from 'vue'
import AccountAvatar from './AccountAvatar.vue'

const props = defineProps({
  avatarUrl: {
    type: String,
    default: '',
  },
  coverStyle: {
    type: Object,
    default: () => ({}),
  },
  hasCoverImage: {
    type: Boolean,
    default: false,
  },
  profile: {
    type: Object,
    required: true,
  },
  signature: {
    type: String,
    default: '',
  },
})

const previewSignature = computed(() => props.signature.trim() || '未填写个人签名')
</script>

<template>
  <section class="account-profile-live-preview" aria-labelledby="profile-live-preview-title">
    <header>
      <div>
        <h3 id="profile-live-preview-title">个人主页预览</h3>
        <p>背景、头像和签名会立即显示在这里。</p>
      </div>
      <span>实时预览</span>
    </header>

    <div class="account-profile-preview-card">
      <div
        class="account-profile-preview-cover"
        :class="{ 'has-image': hasCoverImage }"
        :style="coverStyle"
      >
        <div class="account-profile-preview-identity">
          <AccountAvatar :avatar-url="avatarUrl" :username="profile.username" />
          <div>
            <strong>{{ profile.username }}</strong>
            <small>{{ profile.role }}</small>
            <p>{{ previewSignature }}</p>
          </div>
        </div>
      </div>

      <footer>
        <span>背景：{{ hasCoverImage ? '自定义' : '默认' }}</span>
        <span>头像与签名：仅本页预览</span>
      </footer>
    </div>
  </section>
</template>
