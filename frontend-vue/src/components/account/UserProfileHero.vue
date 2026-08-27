<script setup>
import { RouterLink } from 'vue-router'
import AccountAvatar from './AccountAvatar.vue'

defineProps({
  profile: {
    type: Object,
    required: true,
  },
  routeUserId: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <section class="account-profile-hero" aria-labelledby="account-profile-user-name">
    <AccountAvatar :avatar-url="profile.avatarUrl" :username="profile.username" />

    <div class="account-profile-identity">
      <div class="account-profile-name-row">
        <h2 id="account-profile-user-name">{{ profile.username }}</h2>
        <span>{{ profile.role }}</span>
      </div>
      <p class="account-profile-uid">用户 ID：{{ routeUserId }} · UID：{{ profile.uid }}</p>
      <p class="account-profile-signature">{{ profile.signature }}</p>
      <small>加入时间：{{ profile.joinedAt }}</small>
    </div>

    <RouterLink class="account-profile-primary-link" :to="{ name: 'problems' }">
      继续刷题
    </RouterLink>
  </section>
</template>
