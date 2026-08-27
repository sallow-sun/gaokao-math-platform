<script setup>
import { RouterLink } from 'vue-router'
import { USER_PROFILE_PROTOTYPE, USER_SETTINGS_TABS } from '../../config/account.js'

defineProps({
  activeTab: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="account-settings-page">
    <main class="account-settings-main">
      <RouterLink
        class="account-settings-back"
        :to="{ name: 'user-profile', params: { userId: 'preview' } }"
      >
        ← 返回个人主页预览
      </RouterLink>

      <header class="account-settings-heading">
        <div>
          <p>ACCOUNT SETTINGS</p>
          <h1>用户设置</h1>
          <span>管理公开资料、本机偏好与账户安全信息。</span>
        </div>

        <div class="account-settings-summary" aria-label="当前静态预览用户">
          <strong>{{ USER_PROFILE_PROTOTYPE.username }}</strong>
          <small>UID：{{ USER_PROFILE_PROTOTYPE.uid }}</small>
        </div>

        <nav class="account-settings-tabs" aria-label="用户设置导航">
          <RouterLink
            v-for="tab in USER_SETTINGS_TABS"
            :key="tab.key"
            :to="{ name: tab.routeName }"
            :class="{ 'is-active': activeTab === tab.key }"
            :aria-current="activeTab === tab.key ? 'page' : undefined"
          >
            {{ tab.label }}
          </RouterLink>
        </nav>
      </header>

      <p class="account-settings-prototype-note" role="status">
        当前为静态迁移版本：个人资料和安全信息不会提交；偏好设置仅保存在当前浏览器。
      </p>

      <slot />
    </main>
  </div>
</template>
