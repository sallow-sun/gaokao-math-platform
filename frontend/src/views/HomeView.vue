<script setup>
import { ref } from 'vue'
import { apiRequest } from '../services/apiClient.js'
import { useRouter } from 'vue-router'
import HomeFooter from '../components/home/HomeFooter.vue'
import HomeModeToggle from '../components/home/HomeModeToggle.vue'
import HomeSearchPanel from '../components/home/HomeSearchPanel.vue'
import { useHomePreferences } from '../composables/useHomePreferences'
import { HOME_BACKGROUND_MAX_FILE_SIZE, HOME_BACKGROUND_OPTIONS, HOME_ROUTES } from '../config/home'
import '../assets/styles/home.css'

const router = useRouter()
const randomLoading = ref(false)
const {
  backgroundId,
  hasBackground,
  backgroundStyle,
  statusMessage,
  announce,
  applyPresetBackground,
  applyBackground,
} = useHomePreferences()

async function navigateTo(route, onError) {
  try {
    await router.push(route)
  } catch {
    announce('页面暂时无法打开，请检查首页路由配置')
    onError?.()
  }
}

function goToNormalHome(resetToggle) {
  navigateTo(HOME_ROUTES.normalHome, resetToggle)
}

function searchProblems(keyword) {
  navigateTo({
    path: HOME_ROUTES.problems,
    query: { keyword },
  })
}

async function goToRandomProblem() {
  if (randomLoading.value) return
  randomLoading.value = true
  try {
    const result = await apiRequest('/api/v1/problems/random', {
      signal: AbortSignal.timeout(10000),
    })
    if (!result?.problemId) throw new Error('题库暂时没有可用题目')
    await navigateTo(HOME_ROUTES.question(result.problemId))
  } catch (error) {
    announce(
      error.name === 'TimeoutError'
        ? '随机题目加载超时，请重试'
        : error.message || '随机题目加载失败，请重试',
    )
  } finally {
    randomLoading.value = false
  }
}
</script>

<template>
  <div class="home-page" :class="{ 'has-background': hasBackground }" :style="backgroundStyle">
    <HomeModeToggle @switch="goToNormalHome" />

    <main class="home-main">
      <HomeSearchPanel
        :random-loading="randomLoading"
        :problems-route="HOME_ROUTES.problems"
        :training-route="HOME_ROUTES.training"
        @search="searchProblems"
        @random-problem="goToRandomProblem"
      />
    </main>

    <HomeFooter
      :about-route="HOME_ROUTES.about"
      :help-route="HOME_ROUTES.help"
      :background-options="HOME_BACKGROUND_OPTIONS"
      :selected-background-id="backgroundId"
      :max-background-file-size="HOME_BACKGROUND_MAX_FILE_SIZE"
      :status-message="statusMessage"
      @background-selected="applyBackground"
      @preset-background-selected="applyPresetBackground"
      @background-error="announce"
    />
  </div>
</template>
