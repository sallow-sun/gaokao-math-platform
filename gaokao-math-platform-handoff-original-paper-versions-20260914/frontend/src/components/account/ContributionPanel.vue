<script setup>
import { nextTick, ref, watch } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
import MathText from '../content/MathText.vue'
const props = defineProps({ userId: { type: String, required: true }, owner: Boolean })
const kind = ref('all'),
  status = ref('all'),
  page = ref(1)
const data = ref(null),
  loading = ref(false),
  error = ref(''),
  detail = ref(null),
  detailTitle = ref('')
let requestId = 0
const labels = {
  ACCEPTED: '已采纳',
  RESOLVED: '已解决',
  PENDING: '待处理',
  CHANGES: '待修改',
  DISMISSED: '无需修改',
  REMOVED: '已移入回收站',
}
async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await apiRequest(
      `/api/v1/users/${props.userId}/contributions?${new URLSearchParams({ kind: kind.value, status: status.value, page: page.value })}`,
    )
    if (id === requestId) {
      data.value = result
      page.value = result.page
    }
  } catch (e) {
    if (id === requestId) error.value = e.message
  } finally {
    if (id === requestId) loading.value = false
  }
}
function choose(value) {
  kind.value = value
  filter()
}
function filter() {
  page.value = 1
  load()
}
function move(step) {
  page.value += step
  load()
}
async function view(entry) {
  error.value = ''
  try {
    detail.value = await apiRequest(`/api/v1/users/me/contributions/${entry.kind}/${entry.id}`)
    detailTitle.value = entry.title
    await nextTick()
    document.querySelector('.community-detail')?.scrollIntoView({ block: 'nearest' })
  } catch (e) {
    error.value = e.message
  }
}
watch(() => props.userId, load, { immediate: true })
</script>
<template>
  <section
    id="account-profile-contribution-panel"
    class="community-panel"
    role="tabpanel"
    aria-labelledby="account-profile-contribution-tab"
  >
    <header class="community-heading">
      <div>
        <h2>社区贡献</h2>
        <p>{{ owner ? '查看每一次提交，以及它的处理进度。' : '已公开、已采纳的社区贡献。' }}</p>
      </div>
      <RouterLink v-if="owner" class="community-primary" :to="{ name: 'contribute' }"
        >＋ 上传题目</RouterLink
      >
    </header>
    <p v-if="error" role="alert">{{ error }} <button @click="load">重新加载</button></p>
    <dl v-if="data" class="community-summary">
      <div>
        <dt>已采纳题目</dt>
        <dd>{{ data.summary.accepted }}</dd>
      </div>
      <div>
        <dt>已解决反馈</dt>
        <dd>{{ data.summary.resolved }}</dd>
      </div>
      <div v-if="owner">
        <dt>待处理贡献</dt>
        <dd>{{ data.summary.pending }}</dd>
      </div>
    </dl>
    <div class="community-toolbar">
      <div role="group" aria-label="贡献类型">
        <button
          v-for="option in [
            { value: 'all', label: '全部' },
            { value: 'upload', label: '上传题目' },
            { value: 'feedback', label: '纠错反馈' },
          ]"
          :key="option.value"
          :aria-pressed="kind === option.value"
          @click="choose(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <select v-model="status" aria-label="处理状态" @change="filter">
        <option value="all">全部状态</option>
        <option
          v-for="(label, key) in labels"
          v-show="owner || ['ACCEPTED', 'RESOLVED'].includes(key)"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option></select
      ><RouterLink v-if="owner" :to="{ name: 'feedback' }">我的反馈 →</RouterLink>
    </div>
    <p v-if="loading" role="status">正在加载贡献记录…</p>
    <template v-else-if="data">
      <article v-for="entry in data.items" :key="entry.kind + entry.id" class="community-entry">
        <div>
          <h3>{{ entry.title || '题目已下架' }}</h3>
          <p>
            {{ entry.kind === 'upload' ? '上传题目' : '纠错反馈' }} ·
            {{ new Date(entry.created_at).toLocaleDateString('zh-CN') }}
          </p>
        </div>
        <span
          class="community-badge"
          :class="{ accepted: ['ACCEPTED', 'RESOLVED'].includes(entry.status) }"
          >{{ labels[entry.status] }}</span
        ><RouterLink v-if="entry.number" :to="`/problems/${entry.number}`">查看题目</RouterLink
        ><button
          v-if="owner && (entry.kind === 'feedback' || entry.id.includes('-'))"
          @click="view(entry)"
        >
          处理详情
        </button>
      </article>
      <div v-if="!data.items.length" class="community-empty">
        <h3>暂无{{ kind === 'feedback' ? '反馈' : '贡献' }}记录</h3>
        <p>
          {{
            owner ? '上传一道题目，或在题目详情页提交纠错反馈。' : '采纳后的公开贡献会显示在这里。'
          }}
        </p>
      </div>
      <footer class="community-pagination">
        <span>共 {{ data.total }} 条</span
        ><button :disabled="page <= 1" @click="move(-1)">上一页</button><span>{{ page }}</span
        ><button :disabled="page * 20 >= data.total" @click="move(1)">下一页</button>
      </footer>
    </template>
    <section v-if="detail" class="community-detail" aria-label="贡献处理详情">
      <header>
        <h3>{{ detailTitle }}</h3>
        <button @click="detail = null">关闭详情</button>
      </header>
      <p v-if="detail.response">处理说明：{{ detail.response }}</p>
      <p v-else>暂时没有处理说明。</p>
      <template v-if="detail.document"
        ><h4>题干</h4>
        <MathText :text="detail.document.content || ''" />
        <h4>答案</h4>
        <MathText :text="detail.document.answer || '未填写'" />
        <h4>解析</h4>
        <MathText :text="detail.document.solution || '未填写'" /></template
      ><template v-else
        ><p>问题描述：{{ detail.description }}</p>
        <p v-if="detail.suggestion">建议修改：{{ detail.suggestion }}</p></template
      >
    </section>
  </section>
</template>
<style>
.community-panel {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  margin-top: 24px;
  color: var(--color-ink);
  font-family: var(--font-ui);
}
.community-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
}
.community-heading h2 {
  margin: 0;
  font-size: 20px;
}
.community-heading p,
.community-entry p,
.community-empty p {
  font-size: 13px;
  color: var(--color-ink-muted);
  margin: 8px 0 0;
}
.community-panel button,
.community-panel select,
.community-primary {
  font: inherit;
  font-size: 13px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: white;
  color: var(--color-blue-800);
  cursor: pointer;
  text-decoration: none;
}
.community-primary {
  background: var(--color-blue-800);
  color: white;
  white-space: nowrap;
}
.community-panel button:disabled {
  opacity: 0.45;
  cursor: default;
}
.community-panel a {
  font-size: 13px;
  color: var(--color-blue-800);
}
.community-panel a.community-primary {
  color: white;
}
.community-summary {
  display: flex;
  margin: 0;
  border-block: 1px solid var(--color-border);
}
.community-summary > div {
  flex: 1;
  padding: 20px 24px;
}
.community-summary > div + div {
  border-left: 1px solid var(--color-border);
}
.community-summary dt {
  font-size: 13px;
  color: var(--color-ink-secondary);
}
.community-summary dd {
  margin: 8px 0 0;
  font-size: 28px;
  color: var(--color-blue-800);
  font-weight: 600;
}
.community-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 24px;
}
.community-toolbar > div {
  display: flex;
  gap: 6px;
}
.community-toolbar button[aria-pressed='true'] {
  background: var(--color-blue-050);
  border-color: var(--color-blue-700);
}
.community-toolbar > a {
  margin-left: auto;
}
.community-entry {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 24px;
  border-top: 1px solid var(--color-border);
}
.community-entry > div {
  flex: 1;
  min-width: 0;
}
.community-entry h3 {
  font-size: 15px;
  margin: 0;
  overflow-wrap: anywhere;
}
.community-badge {
  font-size: 12px;
  color: var(--color-ink-muted);
  white-space: nowrap;
}
.community-badge.accepted {
  color: #42755d;
}
.community-empty {
  text-align: center;
  padding: 40px 20px;
}
.community-empty h3 {
  font-size: 16px;
}
.community-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
}
.community-detail {
  margin: 20px 24px;
  padding: 20px;
  background: var(--color-canvas);
  border: 1px solid var(--color-border);
  overflow-wrap: anywhere;
}
.community-detail header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.community-panel > p {
  padding: 0 24px;
}
@media (max-width: 600px) {
  .community-heading,
  .community-toolbar {
    padding: 18px;
  }
  .community-summary > div {
    padding: 16px 12px;
  }
  .community-summary dt {
    font-size: 12px;
  }
  .community-entry {
    padding: 18px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .community-entry > div {
    flex-basis: 65%;
  }
  .community-heading p {
    max-width: 180px;
    line-height: 1.7;
  }
  .community-toolbar > a {
    margin-left: 0;
  }
}
</style>
