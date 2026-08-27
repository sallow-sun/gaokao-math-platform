<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const navigationItems = [
  {
    key: 'home',
    label: '首页',
    route: { name: 'home' },
    routeNames: ['home'],
    iconPaths: ['M3.5 10.5 12 3l8.5 7.5', 'M5.5 9.5V21h13V9.5', 'M9.5 21v-6h5v6'],
  },
  {
    key: 'problems',
    label: '题库',
    route: { name: 'problems' },
    routeNames: ['problems', 'question'],
    iconPaths: [
      'M4.5 4.5h5.25A2.25 2.25 0 0 1 12 6.75V21a3 3 0 0 0-3-3H4.5z',
      'M19.5 4.5h-5.25A2.25 2.25 0 0 0 12 6.75V21a3 3 0 0 1 3-3h4.5z',
    ],
  },
  {
    key: 'training',
    label: '题单',
    route: { name: 'training' },
    routeNames: ['training', 'training-detail'],
    iconPaths: [
      'M8 4.5H5.5A1.5 1.5 0 0 0 4 6v14a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 20V6a1.5 1.5 0 0 0-1.5-1.5H16',
      'M9 3h6v3H9z',
      'M8 11h8',
      'M8 15h8',
    ],
  },
]

const activeRouteName = computed(() => String(route.name ?? ''))
const accountRouteNames = new Set([
  'login',
  'register',
  'forgot-password',
  'user-profile',
  'user-profile-missing',
  'user-settings-profile',
  'user-settings-preferences',
  'user-settings-security',
])
const isAccountNavigationActive = computed(() => accountRouteNames.has(activeRouteName.value))

function isNavigationItemActive(item) {
  return item.routeNames.includes(activeRouteName.value)
}
</script>

<template>
  <aside class="study-navigation" aria-label="学习平台导航">
    <RouterLink class="study-navigation-brand" :to="{ name: 'home' }" aria-label="返回首页">
      <span aria-hidden="true">M</span>
    </RouterLink>

    <nav class="study-navigation-links" aria-label="主要页面">
      <RouterLink
        v-for="item in navigationItems"
        :key="item.key"
        class="study-navigation-link"
        :class="{ 'is-active': isNavigationItemActive(item) }"
        :to="item.route"
        :aria-current="isNavigationItemActive(item) ? 'page' : undefined"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-for="path in item.iconPaths" :key="path" :d="path" />
        </svg>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="study-navigation-user">
      <RouterLink
        class="study-navigation-user-link"
        :class="{ 'is-active': isAccountNavigationActive }"
        :to="{ name: 'login' }"
        :aria-current="isAccountNavigationActive ? 'page' : undefined"
        aria-label="进入账户登录页"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
        <span>我的</span>
        <small>登录</small>
      </RouterLink>
    </div>
  </aside>
</template>
