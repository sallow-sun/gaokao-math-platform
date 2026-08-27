<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UserProfileDetails from '../components/account/UserProfileDetails.vue'
import UserProfileHero from '../components/account/UserProfileHero.vue'
import UserProfileStats from '../components/account/UserProfileStats.vue'
import UserRecentActivity from '../components/account/UserRecentActivity.vue'
import {
  USER_PROFILE_PROTOTYPE,
  USER_PROFILE_STATS_PROTOTYPE,
  USER_RECENT_ACTIVITY_PROTOTYPE,
} from '../config/account.js'

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
})

const routeUserId = computed(() => String(props.userId || '待接入'))
const hasSupportedUserId = computed(
  () => props.userId === 'preview' || /^[1-9]\d*$/.test(props.userId),
)
</script>

<template>
  <div class="account-profile-page">
    <main class="account-profile-main">
      <header class="account-profile-page-heading">
        <div>
          <p>PERSONAL SPACE</p>
          <h1>个人主页</h1>
          <span>查看公开资料与学习概览。</span>
        </div>
        <strong>静态预览</strong>
      </header>

      <section
        v-if="!hasSupportedUserId"
        class="account-profile-route-state"
        aria-labelledby="invalid-user-route-title"
      >
        <span aria-hidden="true">?</span>
        <h2 id="invalid-user-route-title">用户地址无效</h2>
        <p>用户地址需要包含数字用户 ID。当前尚未接入接口，因此无法查询真实用户。</p>
        <RouterLink :to="{ name: 'problems' }">返回题库</RouterLink>
      </section>

      <template v-else>
        <p class="account-profile-prototype-note" role="status">
          当前没有连接用户接口。页面中的“示例用户”和待接入状态仅用于确认布局，不代表真实账户数据。
        </p>

        <UserProfileHero :profile="USER_PROFILE_PROTOTYPE" :route-user-id="routeUserId" />
        <UserProfileStats :stats="USER_PROFILE_STATS_PROTOTYPE" />

        <div class="account-profile-layout">
          <UserProfileDetails :profile="USER_PROFILE_PROTOTYPE" :route-user-id="routeUserId" />

          <aside
            class="account-profile-panel account-profile-shortcuts"
            aria-labelledby="shortcuts-title"
          >
            <header class="account-profile-panel-header">
              <div>
                <h2 id="shortcuts-title">学习入口</h2>
                <p>继续使用已经迁移的学习页面</p>
              </div>
            </header>

            <nav aria-label="个人主页学习入口">
              <RouterLink :to="{ name: 'problems' }">
                <span aria-hidden="true">题</span>
                <span><strong>进入题库</strong><small>浏览和筛选题目</small></span>
                <span aria-hidden="true">›</span>
              </RouterLink>
              <RouterLink :to="{ name: 'training' }">
                <span aria-hidden="true">单</span>
                <span><strong>查看题单</strong><small>整理练习内容</small></span>
                <span aria-hidden="true">›</span>
              </RouterLink>
            </nav>

            <div class="account-profile-owner-placeholder">
              <RouterLink :to="{ name: 'user-settings-profile' }">查看设置页预览</RouterLink>
              <p>身份判断、真实保存与退出操作将在会话接口确定后接入。</p>
            </div>
          </aside>
        </div>

        <UserRecentActivity :records="USER_RECENT_ACTIVITY_PROTOTYPE" />
      </template>
    </main>
  </div>
</template>
