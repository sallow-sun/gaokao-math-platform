<script setup>
import { onBeforeUnmount, ref } from 'vue'
import AdminConfirmDialog from '../components/admin/AdminConfirmDialog.vue'
import AdminHeader from '../components/admin/AdminHeader.vue'
import AdminQuestionEditor from '../components/admin/AdminQuestionEditor.vue'
import AdminQuestionList from '../components/admin/AdminQuestionList.vue'
import AdminSummaryCards from '../components/admin/AdminSummaryCards.vue'
import AdminTabs from '../components/admin/AdminTabs.vue'
import AdminUsersPanel from '../components/admin/AdminUsersPanel.vue'
import { useAdminDashboard } from '../composables/useAdminDashboard.js'
import { ADMIN_TABS, createEmptyAdminProblem } from '../config/admin.js'
import { adminService } from '../services/adminService.js'
import '../assets/styles/admin.css'

const SEARCH_DELAY = 250

const activeTab = ref('users')
const userKeyword = ref('')
const problemKeyword = ref('')
const problemDraft = ref(createEmptyAdminProblem())
const editingProblemId = ref('')
const pendingProblemSave = ref(false)
const pendingMarkdownImport = ref(false)
const pendingUserId = ref('')
const pendingConfirmation = ref(null)
const formFeedback = ref('')
const operationFeedback = ref('')
let feedbackTimer = 0
let userSearchTimer = 0
let problemSearchTimer = 0

const {
  catalogsError,
  catalogsLoading,
  levelOptions,
  problems,
  problemsError,
  problemsLoading,
  problemsPagination,
  problemsQuery,
  sourceOptions,
  statistics,
  summaryError,
  summaryLoading,
  tagOptions,
  typeOptions,
  users,
  usersError,
  usersLoading,
  usersPagination,
  usersQuery,
  createProblem,
  getProblem,
  loadProblemCatalogs,
  loadProblems,
  loadSummary,
  loadUsers,
  updateProblem,
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

function updateProblemKeyword(value) {
  problemKeyword.value = value
  window.clearTimeout(problemSearchTimer)
  problemSearchTimer = window.setTimeout(() => {
    void loadProblems({ keyword: value, page: 1 })
  }, SEARCH_DELAY)
}

function changeProblemPage(page) {
  void loadProblems({ keyword: problemKeyword.value, page })
}

function retryProblems() {
  void loadProblems(problemsQuery.value)
}

function requestUserStatusChange(user) {
  const banning = user.status !== 'banned'

  pendingConfirmation.value = {
    userId: user.id,
    status: banning ? 'banned' : 'active',
    title: banning ? `封禁“${user.username}”？` : `解除“${user.username}”的封禁？`,
    description: banning
      ? '封禁会写入数据库，并使该用户的现有登录会话失效。'
      : '解除后，该用户可以重新登录。',
    confirmLabel: banning ? '确认封禁' : '确认解封',
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

  pendingUserId.value = action.userId

  try {
    const result = await updateUserStatus(action.userId, action.status)
    pendingConfirmation.value = null
    await Promise.all([loadUsers(usersQuery.value), loadSummary()])
    showOperationFeedback(result.message)
  } catch (error) {
    showOperationFeedback(error instanceof Error ? error.message : '无法修改用户状态')
  } finally {
    pendingUserId.value = ''
  }
}

async function editProblem(problem) {
  formFeedback.value = `正在读取 ${problem.id}……`
  try {
    const detail = await getProblem(problem.id)
    editingProblemId.value = detail.id
    problemDraft.value = {
      id: detail.id,
      title: detail.title,
      region: detail.region,
      year: detail.year,
      source: detail.source,
      type: detail.type,
      level: detail.level,
      tags: [...detail.tags],
      content: detail.content,
      answer: detail.answer,
      solution: detail.solution,
      contentFormat: detail.contentFormat,
    }
    formFeedback.value = `正在编辑 ${detail.id}`
  } catch (error) {
    formFeedback.value = error instanceof Error ? error.message : '无法读取题目详情'
  }
}

function updateProblemDraft({ field, value }) {
  problemDraft.value = {
    ...problemDraft.value,
    [field]: value,
  }
}

function updateProblemTag({ checked, tag }) {
  const tags = checked
    ? Array.from(new Set([...problemDraft.value.tags, tag]))
    : problemDraft.value.tags.filter((item) => item !== tag)

  updateProblemDraft({ field: 'tags', value: tags })
}

function resetProblemEditor() {
  editingProblemId.value = ''
  problemDraft.value = createEmptyAdminProblem()
  formFeedback.value = ''
}

async function saveProblem() {
  const wasEditing = Boolean(editingProblemId.value)
  pendingProblemSave.value = true
  formFeedback.value = wasEditing ? '正在保存修改……' : '正在新增题目……'

  try {
    const result = wasEditing
      ? await updateProblem(editingProblemId.value, problemDraft.value)
      : await createProblem(problemDraft.value)

    resetProblemEditor()

    const nextProblemQuery = wasEditing
      ? problemsQuery.value
      : { ...problemsQuery.value, keyword: '', page: 1 }

    if (!wasEditing) {
      problemKeyword.value = ''
    }

    await Promise.all([loadProblems(nextProblemQuery), loadSummary()])
    formFeedback.value = result.message
    showOperationFeedback(result.message)
  } catch (error) {
    formFeedback.value = error instanceof Error ? error.message : '无法保存题目'
  } finally {
    pendingProblemSave.value = false
  }
}

async function importMarkdownFiles(files) {
  if (pendingMarkdownImport.value || !files.length) return
  pendingMarkdownImport.value = true
  const results = []

  for (const file of files) {
    try {
      const problem = await adminService.importMarkdown(file)
      results.push(`${file.name} → ${problem.id}`)
    } catch (error) {
      results.push(`${file.name}：${error?.message || '导入失败'}`)
    }
  }

  formFeedback.value = `Markdown 导入完成：${results.join('；')}`
  showOperationFeedback(`已处理 ${files.length} 个 Markdown 文件`)
  await Promise.all([
    loadProblems({ ...problemsQuery.value, keyword: '', page: 1 }),
    loadProblemCatalogs(),
    loadSummary(),
  ])
  problemKeyword.value = ''
  pendingMarkdownImport.value = false
}

onBeforeUnmount(() => {
  window.clearTimeout(feedbackTimer)
  window.clearTimeout(userSearchTimer)
  window.clearTimeout(problemSearchTimer)
})
</script>

<template>
  <div class="admin-page-root">
    <AdminHeader />

    <main class="admin-page">
      <section class="admin-hero" aria-labelledby="admin-page-title">
        <div>
          <p class="admin-eyebrow">ADMIN CONSOLE</p>
          <h1 id="admin-page-title">管理后台</h1>
          <p>管理用户状态和题库内容。</p>
        </div>
        <span class="admin-role-badge">管理员 · 数据库权限</span>
      </section>

      <aside class="admin-prototype-notice" aria-label="数据保存说明">
        <strong>已连接真实管理接口</strong>
        <p>用户状态和题目内容会立即写入 PostgreSQL，并记录管理员操作日志。</p>
      </aside>

      <AdminSummaryCards
        :error="summaryError"
        :items="statistics"
        :loading="summaryLoading"
        @retry="loadSummary"
      />
      <AdminTabs :active-tab="activeTab" :tabs="ADMIN_TABS" @change="changeTab" />

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
        @status-request="requestUserStatusChange"
      />

      <section
        v-else
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

        <div class="admin-question-layout">
          <AdminQuestionEditor
            :editing="Boolean(editingProblemId)"
            :feedback="formFeedback"
            :level-options="levelOptions"
            :model-value="problemDraft"
            :pending="pendingProblemSave || pendingMarkdownImport"
            :source-options="sourceOptions"
            :tag-options="tagOptions"
            :type-options="typeOptions"
            @cancel="resetProblemEditor"
            @field-change="updateProblemDraft"
            @import-files="importMarkdownFiles"
            @submit="saveProblem"
            @tag-change="updateProblemTag"
          />
          <AdminQuestionList
            :error="problemsError"
            :keyword="problemKeyword"
            :loading="problemsLoading"
            :pagination="problemsPagination"
            :problems="problems"
            @edit="editProblem"
            @keyword-change="updateProblemKeyword"
            @page-change="changeProblemPage"
            @retry="retryProblems"
          />
        </div>
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
