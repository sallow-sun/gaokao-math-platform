<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AdminConfirmDialog from '../components/admin/AdminConfirmDialog.vue'
import AdminHeader from '../components/admin/AdminHeader.vue'
import EditorialWorkbench from '../components/admin/EditorialWorkbench.vue'
import AdminSummaryCards from '../components/admin/AdminSummaryCards.vue'
import AdminTabs from '../components/admin/AdminTabs.vue'
import AdminUsersPanel from '../components/admin/AdminUsersPanel.vue'
import { useAdminDashboard } from '../composables/useAdminDashboard.js'
import { ADMIN_TABS } from '../config/admin.js'
import { editorialService } from '../services/editorialService.js'
import { adminService } from '../services/adminService.js'
import '../assets/styles/admin.css'

const SEARCH_DELAY = 250

const activeTab = ref('problems')
const permission = ref('EDITOR')
const visibleTabs = computed(() =>
  ADMIN_TABS.filter((tab) => tab.key !== 'users' || permission.value === 'MANAGER'),
)
onMounted(async () => {
  try {
    permission.value = (await editorialService.get('/me')).permission
  } catch {
    /* Workbench displays connection errors. */
  }
})
const userKeyword = ref('')
const pendingUserId = ref('')
const pendingConfirmation = ref(null)
const operationFeedback = ref('')
let feedbackTimer = 0
let userSearchTimer = 0

const {
  catalogsError,
  catalogsLoading,
  sourceOptions,
  statistics,
  summaryError,
  summaryLoading,
  tagOptions,
  users,
  usersError,
  usersLoading,
  usersPagination,
  usersQuery,
  deleteUser,
  loadProblemCatalogs,
  loadSummary,
  loadUsers,
  updateUserStatus,
} = useAdminDashboard(adminService)

function showOperationFeedback(message) {
  window.clearTimeout(feedbackTimer)
  operationFeedback.value = message
  feedbackTimer = window.setTimeout(() => {
    operationFeedback.value = ''
  }, 2600)
}

function changeTab(tabKey) {
  activeTab.value = tabKey
}

function updateUserKeyword(value) {
  userKeyword.value = value
  window.clearTimeout(userSearchTimer)
  userSearchTimer = window.setTimeout(() => {
    void loadUsers({ keyword: value, page: 1 })
  }, SEARCH_DELAY)
}

function changeUserPage(page) {
  void loadUsers({ keyword: userKeyword.value, page })
}

function retryUsers() {
  void loadUsers(usersQuery.value)
}

function requestUserStatusChange(user) {
  const banning = user.status !== 'banned'

  pendingConfirmation.value = {
    kind: 'user-status',
    userId: user.id,
    status: banning ? 'banned' : 'active',
    title: banning ? `封禁“${user.username}”？` : `解除“${user.username}”的封禁？`,
    description: banning
      ? '封禁会写入数据库，并使该用户的现有登录会话失效。'
      : '解除后，该用户可以重新登录。',
    confirmLabel: banning ? '确认封禁' : '确认解封',
  }
}

function requestUserDelete(user) {
  pendingConfirmation.value = {
    kind: 'delete-user',
    userId: user.id,
    title: `删除用户“${user.username}”？`,
    description: '该用户的登录账号、学习状态和个人题单将从数据库永久删除，此操作不可撤销。',
    confirmLabel: '确认删除用户',
  }
}

function cancelUserStatusChange() {
  if (!pendingUserId.value) {
    pendingConfirmation.value = null
  }
}

async function confirmUserStatusChange() {
  const action = pendingConfirmation.value

  if (!action) {
    return
  }

  try {
    let result
    if (action.kind === 'delete-user') {
      pendingUserId.value = action.userId
      result = await deleteUser(action.userId)
      await Promise.all([loadUsers(usersQuery.value), loadSummary()])
    } else {
      pendingUserId.value = action.userId
      result = await updateUserStatus(action.userId, action.status)
      await Promise.all([loadUsers(usersQuery.value), loadSummary()])
    }
    pendingConfirmation.value = null
    showOperationFeedback(result.message)
  } catch (error) {
    showOperationFeedback(error instanceof Error ? error.message : '管理操作失败')
  } finally {
    pendingUserId.value = ''
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(feedbackTimer)
  window.clearTimeout(userSearchTimer)
})
</script>

<template>
  <div class="admin-page-root">
    <AdminHeader />

    <main class="admin-page" :class="{ 'is-review-page': activeTab !== 'users' }">
      <section v-if="activeTab === 'users'" class="admin-hero" aria-labelledby="admin-page-title">
        <div>
          <p class="admin-eyebrow">ADMIN CONSOLE</p>
          <h1 id="admin-page-title">管理后台</h1>
          <p>管理用户状态和题库内容。</p>
        </div>
        <span class="admin-role-badge">管理员 · 数据库权限</span>
      </section>

      <AdminSummaryCards
        v-if="activeTab === 'users'"
        :error="summaryError"
        :items="statistics"
        :loading="summaryLoading"
        @retry="loadSummary"
      />
      <AdminTabs :active-tab="activeTab" :tabs="visibleTabs" @change="changeTab" />

      <AdminUsersPanel
        v-if="activeTab === 'users'"
        :error="usersError"
        :keyword="userKeyword"
        :loading="usersLoading"
        :pagination="usersPagination"
        :pending-user-id="pendingUserId"
        :users="users"
        @keyword-change="updateUserKeyword"
        @page-change="changeUserPage"
        @retry="retryUsers"
        @delete-request="requestUserDelete"
        @status-request="requestUserStatusChange"
      />

      <section
        v-show="activeTab !== 'users'"
        id="admin-panel-problems"
        class="admin-problem-panel"
        role="tabpanel"
        aria-labelledby="admin-tab-problems"
        tabindex="0"
      >
        <div v-if="catalogsError" class="admin-data-message is-error" role="alert">
          <p>{{ catalogsError }}</p>
          <button type="button" class="admin-inline-action" @click="loadProblemCatalogs">
            重新读取题目选项
          </button>
        </div>
        <p v-else-if="catalogsLoading" class="admin-data-message" role="status">
          正在读取题目选项……
        </p>

        <EditorialWorkbench :tags="tagOptions" :sources="sourceOptions" />
      </section>
    </main>

    <AdminConfirmDialog
      :busy="Boolean(pendingUserId)"
      :confirm-label="pendingConfirmation?.confirmLabel"
      :description="pendingConfirmation?.description"
      :open="Boolean(pendingConfirmation)"
      :title="pendingConfirmation?.title"
      @cancel="cancelUserStatusChange"
      @confirm="confirmUserStatusChange"
    />

    <p v-show="operationFeedback" class="admin-operation-feedback" role="status" aria-live="polite">
      {{ operationFeedback }}
    </p>
  </div>
</template>
