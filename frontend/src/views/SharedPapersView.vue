<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../services/apiClient.js'
import '../assets/styles/shared-papers.css'
const route = useRoute(),
  router = useRouter()
const data = ref(null),
  error = ref(''),
  loading = ref(false)
const q = ref(String(route.query.q || '')),
  kind = ref(String(route.query.kind || '')),
  year = ref(String(route.query.year || '')),
  examMode = ref(String(route.query.examMode || '')),
  checked = ref(route.query.checked === 'true'),
  sort = ref(String(route.query.sort || 'newest'))
const scope = computed(() => String(route.query.scope || 'all'))
let revision = 0
async function load() {
  const request = ++revision
  loading.value = true
  error.value = ''
  try {
    const result = await apiRequest('/api/v1/papers?' + new URLSearchParams(route.query))
    if (request === revision) data.value = result
  } catch (e) {
    if (request === revision) {
      error.value = e.message
      data.value = null
    }
  } finally {
    if (request === revision) loading.value = false
  }
}
function filter() {
  router.replace({
    query: {
      ...route.query,
      q: q.value,
      kind: kind.value,
      year: year.value || undefined,
      examMode: examMode.value,
      checked: String(checked.value),
      sort: sort.value,
      page: '1',
    },
  })
}
function tab(value) {
  router.replace({ query: { ...route.query, scope: value, page: '1' } })
}
function turn(step) {
  router.replace({ query: { ...route.query, page: String(data.value.page + step) } })
}
watch(() => route.fullPath, () => {
  q.value = String(route.query.q || '')
  kind.value = String(route.query.kind || '')
  year.value = String(route.query.year || '')
  examMode.value = String(route.query.examMode || '')
  checked.value = route.query.checked === 'true'
  sort.value = String(route.query.sort || 'newest')
  load()
}, { immediate: true })
</script>
<template>
  <main class="shared-papers-page">
    <header class="shared-page-heading">
      <div>
        <p class="shared-eyebrow">MATHSEA · 试卷资源库</p>
        <h1>发现一份好试卷</h1>
        <p>查找、预览与打印，也可以复制组卷，编排自己的练习。</p>
      </div>
      <div class="shared-actions">
        <button v-if="!data?.pdfAvailable" disabled>PDF 上传 · 暂未开放</button>
        <RouterLink v-else class="shared-button" :to="{ name: 'paper-publish', query: { kind: 'PDF' } }"
          >上传 PDF</RouterLink
        ><RouterLink class="shared-button primary" :to="{ name: 'paper-publish' }"
          >分享组卷</RouterLink
        >
      </div>
    </header>
    <div class="shared-tabs" role="group" aria-label="试卷分类">
      <button
        v-for="entry in [
          { key: 'all', label: '全部试卷' },
          { key: 'mine', label: '我的发布' },
          { key: 'favorites', label: '我的收藏' },
        ]"
        :key="entry.key"
        :aria-pressed="scope === entry.key"
        @click="tab(entry.key)"
      >
        {{ entry.label }}
      </button>
    </div>
    <form class="shared-filters" @submit.prevent="filter">
      <input
        v-model="q"
        type="search"
        aria-label="搜索试卷"
        placeholder="搜索试卷名称或来源…"
        maxlength="160"
      /><select v-model="kind" aria-label="试卷格式">
        <option value="">全部格式</option>
        <option value="PDF">PDF 文件</option>
        <option value="BUILDER">可编辑组卷</option></select
      ><input
        v-model="year"
        type="number"
        min="1900"
        max="2100"
        placeholder="年份"
        aria-label="年份"
        class="shared-year"
      /><select v-model="examMode" aria-label="适用考试">
        <option value="">全部考试</option>
        <option>新高考Ⅰ卷</option>
        <option>新高考Ⅱ卷</option>
        <option>地方卷</option>
        <option>其他</option></select
      ><label class="shared-check"><input v-model="checked" type="checkbox" />人工校核</label
      ><button type="submit" class="primary">筛选</button>
    </form>
    <div class="shared-result-bar">
      <span>{{ data?.total || 0 }} 份试卷</span
      ><select v-model="sort" aria-label="试卷排序" @change="filter">
        <option value="newest">最新发布</option>
        <option value="favorites">收藏最多</option>
        <option value="hot">近期热门</option>
      </select>
    </div>
    <p v-if="error" role="alert" class="shared-error">
      {{ error }} <button @click="load">重试</button
      ><RouterLink
        v-if="scope !== 'all'"
        :to="{ name: 'login', query: { redirect: route.fullPath } }"
        >登录账号</RouterLink
      >
    </p>
    <p v-if="loading" class="shared-empty" role="status">正在加载试卷…</p>
    <div v-else-if="data?.items.length" class="shared-grid">
      <RouterLink
        v-for="paper in data.items"
        :key="paper.id"
        class="shared-card"
        :to="{ name: 'shared-paper', params: { id: paper.id } }"
        ><div class="shared-cover">
          <span>{{ paper.kind === 'PDF' ? 'PDF · 原卷' : 'MATH · 可编辑组卷' }}</span
          ><span v-if="paper.hot" class="shared-hot">HOT</span><strong>{{ paper.title }}</strong
          ><i></i
          ><small
            >{{ paper.exam_mode || '数学试卷' }}<span>{{ paper.year || '' }}</span></small
          >
        </div>
        <div class="shared-card-body">
          <h2>{{ paper.title }}</h2>
          <p>{{ paper.source || '用户分享' }}</p>
          <div class="shared-badges">
            <span v-if="paper.checked_at">✓ 人工校核</span
            ><span v-if="paper.has_answers">含答案</span
            ><span v-if="paper.kind === 'BUILDER'"
              >{{ paper.question_count }} 题 · {{ paper.total_score }} 分</span
            ><span v-else>{{ (paper.file_bytes / 1048576).toFixed(1) }} MB</span>
          </div>
          <footer>
            {{ paper.author }}<span>收藏 {{ paper.favorite_count }}</span>
          </footer>
        </div></RouterLink
      >
    </div>
    <div v-else-if="!error" class="shared-empty">
      <h2>这里还没有试卷</h2>
      <p>调整筛选条件，或分享你的第一份组卷。</p>
    </div>
    <footer v-if="data?.total" class="shared-pagination">
      <button :disabled="data.page <= 1 || loading" @click="turn(-1)">上一页</button
      ><span>{{ data.page }} / {{ Math.ceil(data.total / 20) }}</span
      ><button :disabled="data.page * 20 >= data.total || loading" @click="turn(1)">下一页</button>
    </footer>
  </main>
</template>
