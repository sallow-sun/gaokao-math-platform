<script setup>
import { computed, ref, watch } from 'vue'
import ContributionPanel from '../components/account/ContributionPanel.vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import UserActivityHeatmap from '../components/account/UserActivityHeatmap.vue'
import UserProfileHero from '../components/account/UserProfileHero.vue'
import UserProfileStats from '../components/account/UserProfileStats.vue'
import UserProblemTypeChart from '../components/account/UserProblemTypeChart.vue'
import UserTagStatsChart from '../components/account/UserTagStatsChart.vue'
import { userService } from '../services/userService.js'

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
})

const route = useRoute()
const router = useRouter()
const activeTab = computed(() =>
  route.query.tab === 'contributions' ? 'contributions' : 'learning',
)
function changeTab(tab) {
  router.replace({ query: { ...route.query, tab: tab === 'contributions' ? tab : undefined } })
}
const profile = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const hasValidUserId = computed(() => /^[1-9]\d*$/.test(props.userId))
const overviewStats = computed(() => {
  const stats = profile.value?.stats ?? {}
  return [
    {
      key: 'completed',
      label: '已完成题目',
      value: stats.completed ?? 0,
      description: '累计标记为已做',
    },
    { key: 'favorite', label: '收藏题目', value: stats.favorite ?? 0, description: '当前收藏数量' },
    {
      key: 'streak',
      label: '连续学习',
      value: `${stats.streak ?? 0} 天`,
      description: '按已做日期连续计算',
    },
  ]
})

async function loadProfile() {
  profile.value = null
  errorMessage.value = ''

  if (!hasValidUserId.value) {
    errorMessage.value = '用户地址无效'
    return
  }

  loading.value = true
  try {
    profile.value = await userService.publicProfile(props.userId)
  } catch (error) {
    errorMessage.value = error?.status === 404 ? '用户不存在' : error?.message || '用户资料加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => props.userId, loadProfile, { immediate: true })
</script>

<template>
  <div class="account-profile-page">
    <main class="account-profile-main">
      <section
        v-if="loading || errorMessage"
        class="account-profile-route-state"
        :aria-labelledby="errorMessage ? 'profile-error-title' : 'profile-loading-title'"
      >
        <span aria-hidden="true">{{ errorMessage ? '?' : '…' }}</span>
        <h2 v-if="errorMessage" id="profile-error-title">{{ errorMessage }}</h2>
        <h2 v-else id="profile-loading-title">正在加载个人主页</h2>
        <p v-if="errorMessage">请检查地址中的数字用户 ID 是否正确。</p>
        <RouterLink v-if="errorMessage" :to="{ name: 'problems' }">返回题库</RouterLink>
      </section>

      <template v-else-if="profile">
        <UserProfileHero
          :editable="false"
          :profile="profile"
          :show-settings="profile.canEdit"
          :active-tab="activeTab"
          @change-tab="changeTab"
        />
        <ContributionPanel
          v-if="activeTab === 'contributions'"
          :key="userId"
          :user-id="userId"
          :owner="profile.canEdit"
        />
        <UserProfileStats v-if="activeTab === 'learning'" :stats="overviewStats" />

        <section
          v-if="activeTab === 'learning'"
          id="account-profile-learning-panel"
          class="account-profile-learning-panel"
          role="tabpanel"
          aria-labelledby="account-profile-learning-tab"
          tabindex="0"
        >
          <div class="account-profile-chart-grid">
            <UserActivityHeatmap :records="profile.dailyActivity" />
            <UserProblemTypeChart :items="profile.typeStats" />
          </div>

          <UserTagStatsChart :items="profile.tagStats" />
        </section>
      </template>
    </main>
  </div>
</template>
