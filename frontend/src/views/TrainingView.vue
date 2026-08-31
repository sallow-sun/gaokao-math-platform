<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import TrainingCreateDialog from '../components/training/TrainingCreateDialog.vue'
import TrainingListCard from '../components/training/TrainingListCard.vue'
import TrainingTabs from '../components/training/TrainingTabs.vue'
import { useProblemsUserMarks } from '../composables/useProblemsUserMarks.js'
import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'
import { usePracticeListsStore } from '../stores/practiceLists.js'
import '../assets/styles/training.css'

const VALID_TABS = ['official', 'square', 'mine']
const route = useRoute()
const router = useRouter()
const practiceListsStore = usePracticeListsStore()
const { completedProblemIds } = useProblemsUserMarks(PROBLEMS_PROTOTYPE_ITEMS)
const createDialogOpen = ref(false)
const publicListLoading = ref(false)
const publicListError = ref('')
const operationFeedbackMessage = ref('')
let operationFeedbackTimer = 0

const activeTab = computed(() => {
  const tab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  return VALID_TABS.includes(tab) ? tab : 'mine'
})

const practiceListCards = computed(() =>
  practiceListsStore.lists.map((practiceList) => ({
    practiceList,
    completedCount: practiceList.items.filter((item) =>
      completedProblemIds.value.includes(item.problemId),
    ).length,
  })),
)

function showOperationFeedback(message) {
  window.clearTimeout(operationFeedbackTimer)
  operationFeedbackMessage.value = message
  operationFeedbackTimer = window.setTimeout(() => {
    operationFeedbackMessage.value = ''
  }, 2200)
}

async function changeTab(tab) {
  const nextQuery = { ...route.query, tab }

  try {
    await router.replace({ name: 'training', query: nextQuery })
  } catch {
    showOperationFeedback('无法切换题单分类，请稍后重试')
  }
}

function openCreateDialog() {
  createDialogOpen.value = true
}

function closeCreateDialog() {
  createDialogOpen.value = false
}

async function createPracticeList(formValue) {
  try {
    const practiceList = await practiceListsStore.createPracticeList(formValue)
    closeCreateDialog()
    showOperationFeedback(`题单“${practiceList.title}”已创建`)
  } catch (error) {
    showOperationFeedback(error?.message || '题单创建失败')
  }
}

async function loadPublicTab(tab) {
  if (!['official', 'square'].includes(tab)) return
  publicListLoading.value = true
  publicListError.value = ''
  try {
    await practiceListsStore.loadPublicLists(tab)
  } catch (error) {
    publicListError.value = error?.message || '公开题单加载失败'
  } finally {
    publicListLoading.value = false
  }
}

watch(activeTab, loadPublicTab)
onMounted(async () => {
  await practiceListsStore.initialize()
  loadPublicTab(activeTab.value)
})

onBeforeUnmount(() => {
  window.clearTimeout(operationFeedbackTimer)
})
</script>

<template>
  <div class="training-page">
    <main class="training-main">
      <header class="training-header" aria-labelledby="training-page-title">
        <h1 id="training-page-title">高考数学题单</h1>
        <p>循序而进，聚沙成塔。</p>
      </header>

      <section class="training-shell" aria-label="题单浏览区">
        <TrainingTabs :active-tab="activeTab" @change="changeTab" />

        <section
          v-if="activeTab === 'official'"
          id="training-panel-official"
          class="training-tab-panel"
          role="tabpanel"
          aria-labelledby="training-tab-official"
          tabindex="0"
        >
          <div v-if="publicListLoading" class="training-integration-state" role="status">
            <h2>正在加载官方题单……</h2>
          </div>
          <div v-else-if="publicListError" class="training-integration-state" role="alert">
            <h2>官方题单加载失败</h2>
            <p>{{ publicListError }}</p>
            <button class="training-secondary-action" @click="loadPublicTab('official')">重试</button>
          </div>
          <div
            v-else-if="practiceListsStore.publicLists.official.length"
            class="training-panel-content"
          >
            <header class="training-panel-header">
              <div class="training-panel-heading">
                <h2>官方题单</h2>
                <p>由数海首位用户负责维护，所有人均可查看和打印。</p>
              </div>
            </header>
            <div class="training-card-grid">
              <TrainingListCard
                v-for="practiceList in practiceListsStore.publicLists.official"
                :key="practiceList.id"
                :completed-count="practiceList.completedCount"
                :practice-list="practiceList"
              />
            </div>
          </div>
          <div v-else class="training-integration-state">
            <span class="training-empty-mark" aria-hidden="true">官</span>
            <h2>暂时没有官方题单</h2>
            <p>首位用户注册后，系统会自动创建官方起步题单。</p>
          </div>
        </section>

        <section
          v-else-if="activeTab === 'square'"
          id="training-panel-square"
          class="training-tab-panel"
          role="tabpanel"
          aria-labelledby="training-tab-square"
          tabindex="0"
        >
          <div v-if="publicListLoading" class="training-integration-state" role="status">
            <h2>正在加载题单广场……</h2>
          </div>
          <div v-else-if="publicListError" class="training-integration-state" role="alert">
            <h2>题单广场加载失败</h2>
            <p>{{ publicListError }}</p>
            <button class="training-secondary-action" @click="loadPublicTab('square')">重试</button>
          </div>
          <div
            v-else-if="practiceListsStore.publicLists.square.length"
            class="training-panel-content"
          >
            <header class="training-panel-header">
              <div class="training-panel-heading">
                <h2>题单广场</h2>
                <p>浏览其他用户公开分享的题单。</p>
              </div>
            </header>
            <div class="training-card-grid">
              <TrainingListCard
                v-for="practiceList in practiceListsStore.publicLists.square"
                :key="practiceList.id"
                :completed-count="practiceList.completedCount"
                :practice-list="practiceList"
              />
            </div>
          </div>
          <div v-else class="training-integration-state">
            <span class="training-empty-mark" aria-hidden="true">享</span>
            <h2>暂时没有公开题单</h2>
            <p>登录后创建公开题单，它会出现在这里。</p>
          </div>
        </section>

        <section
          v-else
          id="training-panel-mine"
          class="training-tab-panel"
          role="tabpanel"
          aria-labelledby="training-tab-mine"
          tabindex="0"
        >
          <div class="training-panel-content">
            <header class="training-panel-header">
              <div class="training-panel-heading">
                <h2>我的题单</h2>
                <p>{{ practiceListsStore.authenticated ? '题单已保存到账号数据库。' : '未登录时题单暂存在此浏览器。' }}</p>
              </div>
              <div class="training-panel-actions">
                <span>{{ practiceListsStore.lists.length }} 份题单</span>
                <button type="button" class="training-primary-action" @click="openCreateDialog">
                  创建题单
                </button>
              </div>
            </header>

            <div v-if="practiceListCards.length" class="training-card-grid">
              <TrainingListCard
                v-for="card in practiceListCards"
                :key="card.practiceList.id"
                :completed-count="card.completedCount"
                :default-list="practiceListsStore.defaultListId === card.practiceList.id"
                :practice-list="card.practiceList"
              />
            </div>

            <div v-else class="training-empty-state">
              <span class="training-empty-mark" aria-hidden="true">单</span>
              <h2>暂时还没有题单</h2>
              <p>创建第一份题单，再从题库中逐步加入需要练习的题目。</p>
              <div class="training-empty-actions">
                <button type="button" class="training-primary-action" @click="openCreateDialog">
                  创建第一份题单
                </button>
                <RouterLink class="training-secondary-action" to="/problems">浏览题库</RouterLink>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>

    <TrainingCreateDialog
      :allow-official="practiceListsStore.authUser?.officialListOwner === true"
      :open="createDialogOpen"
      @cancel="closeCreateDialog"
      @create="createPracticeList"
    />

    <p
      v-show="operationFeedbackMessage"
      class="training-operation-feedback"
      :class="{ 'is-visible': operationFeedbackMessage }"
      role="status"
      aria-live="polite"
    >
      {{ operationFeedbackMessage }}
    </p>
  </div>
</template>
