<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UserActivityHeatmap from '../components/account/UserActivityHeatmap.vue'
import UserProfileHero from '../components/account/UserProfileHero.vue'
import UserProblemTypeChart from '../components/account/UserProblemTypeChart.vue'
import UserTagStatsChart from '../components/account/UserTagStatsChart.vue'
import {
  USER_ACTIVITY_PROTOTYPE,
  USER_PROFILE_PROTOTYPE,
  USER_PROBLEM_TYPE_STATS_PROTOTYPE,
  USER_TAG_STATS_PROTOTYPE,
} from '../config/account.js'

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
})

const isPrototypePreview = computed(() => props.userId === 'preview')
const hasSupportedUserId = computed(
  () => isPrototypePreview.value || /^[1-9]\d*$/.test(props.userId),
)
// 用户接口尚未接入时，所有有效地址展示的都是同一份本地个人资料。
// 因此暂时都视为当前用户主页，避免数字地址误进入只读模式。
const isEditableProfile = computed(() => hasSupportedUserId.value)
</script>

<template>
  <div class="account-profile-page">
    <main class="account-profile-main">
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
        <UserProfileHero :editable="isEditableProfile" :profile="USER_PROFILE_PROTOTYPE" />

        <p class="account-profile-prototype-note" role="status">
          当前为可编辑的个人主页前端原型。名称、头像、背景和签名只保存在当前浏览器；等级和学习统计尚未连接用户接口。
        </p>

        <section
          id="account-profile-learning-panel"
          class="account-profile-learning-panel"
          role="tabpanel"
          aria-labelledby="account-profile-learning-tab"
          tabindex="0"
        >
          <div class="account-profile-chart-grid">
            <UserActivityHeatmap :records="USER_ACTIVITY_PROTOTYPE" />
            <UserProblemTypeChart :items="USER_PROBLEM_TYPE_STATS_PROTOTYPE" />
          </div>

          <UserTagStatsChart :items="USER_TAG_STATS_PROTOTYPE" />
        </section>
      </template>
    </main>
  </div>
</template>
