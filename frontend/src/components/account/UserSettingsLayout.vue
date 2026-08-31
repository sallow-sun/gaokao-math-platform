<script setup>
import { RouterLink } from 'vue-router'
import { computed } from 'vue'
import { USER_SETTINGS_TABS } from '../../config/account.js'

const props = defineProps({
  activeTab: {
    type: String,
    required: true,
  },
})

const SETTINGS_TAB_DESCRIPTIONS = Object.freeze({
  preferences: '显示、打印与操作',
  security: '登录与账户保护',
})

const SETTINGS_CONTEXT = Object.freeze({
  preferences: {
    eyebrow: 'LEARNING PREFERENCES',
    title: '学习偏好',
    description: '更改会立即保存到当前浏览器，并立即影响题库、题目和题单页面。',
    status: '自动保存',
  },
  security: {
    eyebrow: 'ACCOUNT SECURITY',
    title: '账号与安全',
    description: '账户接口和验证规则尚未确定，本页当前不会收集或提交信息。',
    status: '待接入',
  },
})

const activeContext = computed(
  () => SETTINGS_CONTEXT[props.activeTab] ?? SETTINGS_CONTEXT.preferences,
)
</script>

<template>
  <div class="account-settings-page">
    <main class="account-settings-main">
      <header class="account-settings-heading">
        <div>
          <p>ACCOUNT SETTINGS</p>
          <h1>用户设置</h1>
          <span>集中管理学习体验与账户安全；公开资料可在个人主页直接修改。</span>
        </div>

        <RouterLink
          class="account-settings-back"
          :to="{ name: 'user-settings-profile' }"
        >
          ← 查看个人主页
        </RouterLink>
      </header>

      <div class="account-settings-layout">
        <aside class="account-settings-sidebar">
          <p class="account-settings-sidebar-title">设置分类</p>
          <nav class="account-settings-tabs" aria-label="用户设置导航">
            <RouterLink
              v-for="tab in USER_SETTINGS_TABS"
              :key="tab.key"
              :to="{ name: tab.routeName }"
              :class="{ 'is-active': activeTab === tab.key }"
              :aria-current="activeTab === tab.key ? 'page' : undefined"
            >
              <span>{{ tab.label }}</span>
              <small>{{ SETTINGS_TAB_DESCRIPTIONS[tab.key] }}</small>
            </RouterLink>
          </nav>
        </aside>

        <section class="account-settings-content" :aria-label="activeContext.title">
          <header class="account-settings-context">
            <div>
              <p>{{ activeContext.eyebrow }}</p>
              <h2>{{ activeContext.title }}</h2>
              <span>{{ activeContext.description }}</span>
            </div>
            <strong :class="`is-${activeTab}`">{{ activeContext.status }}</strong>
          </header>

          <slot />
        </section>
      </div>
    </main>
  </div>
</template>
