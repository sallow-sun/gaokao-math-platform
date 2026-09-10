<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { usePracticeListsStore } from '../../stores/practiceLists.js'
import { lastProblemsVisit } from '../../services/problemNavigation.js'

const route = useRoute()
const router = useRouter()
const practiceListsStore = usePracticeListsStore()
const loggingOut = ref(false)
const logoutError = ref('')

const baseNavigationItems = [
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
const navigationItems = computed(() => {
  const items = baseNavigationItems.map((item) =>
    item.key === 'problems' && route.name === 'question'
      ? { ...item, route: lastProblemsVisit.path }
      : item,
  )
  if (String(practiceListsStore.authUser?.role ?? '').toUpperCase() === 'ADMIN') {
    items.push({
      key: 'admin',
      label: '管理',
      route: { name: 'admin' },
      routeNames: ['admin'],
      iconPaths: ['M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6z', 'M9 12l2 2 4-4'],
    })
  }
  return items
})

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
const accountRoute = computed(() =>
  practiceListsStore.authenticated
    ? { name: 'user-profile', params: { userId: practiceListsStore.authUser?.id } }
    : { name: 'login', query: { redirect: route.fullPath } },
)
const accountLabel = computed(() => practiceListsStore.authUser?.username || '我的')
const accountStatus = computed(() => {
  if (!practiceListsStore.initialized || practiceListsStore.loading) return '检查中…'
  return practiceListsStore.authenticated ? '已登录' : '登录'
})

function isNavigationItemActive(item) {
  return item.routeNames.includes(activeRouteName.value)
}

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  logoutError.value = ''
  try {
    await practiceListsStore.logout()
    await router.replace({ name: 'login' })
  } catch (error) {
    logoutError.value = error?.message || '退出失败，请稍后重试'
  } finally {
    loggingOut.value = false
  }
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
        :to="accountRoute"
        :aria-current="isAccountNavigationActive ? 'page' : undefined"
        :aria-label="
          practiceListsStore.authenticated ? `当前用户：${accountLabel}` : '进入账户登录页'
        "
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
        <span>{{ accountLabel }}</span>
        <small>{{ accountStatus }}</small>
      </RouterLink>
      <button
        v-if="practiceListsStore.authenticated"
        class="study-navigation-logout"
        type="button"
        :disabled="loggingOut"
        :title="logoutError || (loggingOut ? '正在退出登录' : '退出登录')"
        @click="logout"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 5H5v14h5" />
          <path d="M14 8l4 4-4 4" />
          <path d="M8 12h10" />
        </svg>
        <span>{{ loggingOut ? '退出中' : '退出' }}</span>
      </button>
    </div>
  </aside>
</template>
