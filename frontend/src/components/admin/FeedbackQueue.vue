<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
import MathText from '../content/MathText.vue'
const emit = defineEmits(['edit'])
defineProps({ canManage: Boolean })
const status = ref('OPEN'),
  rows = ref([]),
  total = ref(0),
  page = ref(1),
  selected = ref(null),
  reports = ref([]),
  problem = ref(null),
  busy = ref(false),
  message = ref(''),
  response = ref('')
const pending = computed(() =>
  reports.value
    .filter((r) => ['OPEN', 'CHANGES'].includes(r.status))
    .map((r) => ({ id: r.id, version: r.version })),
)
const labels = { OPEN: '待处理', CHANGES: '待修改', RESOLVED: '已解决', DISMISSED: '无需修改' }
async function run(fn) {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    await fn()
  } catch (e) {
    message.value = e.message
  } finally {
    busy.value = false
  }
}
async function load() {
  const data = await apiRequest(`/api/v1/admin/feedback?status=${status.value}&page=${page.value}`)
  rows.value = data.items
  total.value = data.total
}
async function open(entry) {
  await run(async () => {
    selected.value = entry
    problem.value = null
    reports.value = []
    response.value = ''
    reports.value = await apiRequest(`/api/v1/admin/feedback/${entry.number}`)
    if (!entry.deleted) problem.value = await apiRequest(`/api/v1/problems/${entry.number}`)
  })
}
async function resolve(next) {
  if (!response.value.trim()) {
    message.value = '请填写处理说明，提交者也能看到。'
    return
  }
  await run(async () => {
    await apiRequest('/api/v1/admin/feedback/resolve', {
      method: 'POST',
      body: { items: pending.value, status: next, response: response.value },
    })
    selected.value = null
    reports.value = []
    await load()
  })
}
async function hide() {
  if (!confirm(`暂时下架 ${selected.value.number}？可在回收站恢复。`)) return
  await run(async () => {
    await apiRequest('/api/v1/admin/problem-trash', {
      method: 'POST',
      body: { numbers: [selected.value.number] },
    })
    selected.value.deleted = true
    problem.value = null
    message.value = '已下架，可从回收站恢复'
    await load()
  })
}
onMounted(() => run(load))
</script>
<template>
  <section class="feedback-workspace">
    <div class="editorial-actions">
      <button
        v-for="(label, key) in { OPEN: '待处理', CHANGES: '待修改', DONE: '已处理' }"
        :key="key"
        :aria-pressed="status === key"
        :disabled="busy"
        @click="
          () => {
            status = key
            page = 1
            selected = null
            run(load)
          }
        "
      >
        {{ label }}
      </button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <div class="feedback-review-grid">
      <aside>
        <button
          v-for="entry in rows"
          :key="entry.number"
          class="feedback-queue-item"
          :aria-pressed="selected?.number === entry.number"
          :disabled="busy"
          @click="open(entry)"
        >
          <strong>{{ entry.title }}</strong
          ><small
            >{{ entry.number }} · {{ entry.count }} 条反馈{{
              entry.deleted ? ' · 已下架' : ''
            }}</small
          >
        </button>
        <p v-if="!rows.length">当前没有反馈</p>
        <div class="editorial-actions">
          <button
            :disabled="busy || page <= 1"
            @click="
              () => {
                page--
                run(load)
              }
            "
          >
            上页</button
          ><span>{{ page }}</span
          ><button
            :disabled="busy || page * 30 >= total"
            @click="
              () => {
                page++
                run(load)
              }
            "
          >
            下页
          </button>
        </div>
      </aside>
      <div v-if="selected" class="feedback-reading">
        <header>
          <h3>{{ selected.title }}</h3>
          <span>{{ selected.number }}</span>
        </header>
        <div v-if="problem" class="feedback-current">
          <section v-for="key in ['content', 'answer', 'solution']" :key="key">
            <h4>{{ { content: '题干', answer: '答案', solution: '解析' }[key] }}</h4>
            <MathText :text="problem[key] || ''" />
          </section>
          <img
            v-for="asset in problem.assets || []"
            :key="asset.id || asset.url"
            :src="asset.url"
            :alt="asset.altText || '配图'"
          />
        </div>
        <p v-else-if="selected.deleted">此题已下架。下方保留反馈提交时的内容。</p>
        <article v-for="report in reports" :key="report.id" class="feedback-report">
          <strong>{{ report.kind }} · {{ labels[report.status] }}</strong>
          <p>{{ report.description }}</p>
          <p v-if="report.suggestion">建议：{{ report.suggestion }}</p>
          <a v-if="report.image_url" :href="report.image_url" target="_blank" rel="noopener"
            ><img :src="report.image_url" alt="反馈截图"
          /></a>
          <p v-if="report.response">处理说明：{{ report.response }}</p>
          <details>
            <summary>提交时的题目</summary>
            <MathText
              v-for="key in ['content', 'answer', 'solution']"
              :key="key"
              :text="JSON.parse(report.problem_snapshot || '{}')[key] || ''"
            />
          </details>
        </article>
        <div v-if="pending.length" class="feedback-resolution">
          <label
            >处理说明<textarea
              v-model="response"
              maxlength="1500"
              rows="2"
              placeholder="说明修改结果或无需修改的原因"
            />
          </label>
          <div class="editorial-actions">
            <button
              class="editorial-primary"
              :disabled="busy || selected.deleted"
              @click="emit('edit', { number: selected.number, items: pending, summary: reports.filter(r => ['OPEN','CHANGES'].includes(r.status)).map(r => `${r.kind}：${r.description}`).join('\n') })"
            >
              修改题目并解决</button
            ><button :disabled="busy" @click="resolve('CHANGES')">转待修改</button
            ><button :disabled="busy" @click="resolve('RESOLVED')">标记已解决</button
            ><button :disabled="busy" @click="resolve('DISMISSED')">无需修改</button
            ><button v-if="canManage && !selected.deleted" :disabled="busy" @click="hide">暂时下架</button>
          </div>
        </div>
      </div>
      <p v-else>选择一道题，集中处理相关反馈。</p>
    </div>
  </section>
</template>
<style scoped>
.feedback-review-grid {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
  margin-top: 16px;
}
.feedback-queue-item {
  display: grid;
  text-align: left;
  width: 100%;
  margin-bottom: 8px;
  gap: 8px;
}
.feedback-queue-item small {
  color: #647b8d;
}
.feedback-reading {
  background: white;
  padding: 24px;
  border: 1px solid #dce5ed;
  border-radius: 6px;
  min-width: 0;
}
.feedback-reading img {
  max-width: 100%;
  max-height: 320px;
}
.feedback-report {
  border-top: 1px solid #dce5ed;
  padding: 18px 0;
  overflow-wrap: anywhere;
}
.feedback-current {
  padding-bottom: 24px;
}
.feedback-resolution {
  position: sticky;
  bottom: 0;
  background: #f7fafc;
  padding: 16px;
}
.feedback-resolution label {
  display: grid;
  gap: 8px;
}
.feedback-resolution textarea {
  font: inherit;
  padding: 8px;
  max-width: 100%;
}
.feedback-resolution .editorial-actions {
  margin-top: 12px;
}
@media (max-width: 800px) {
  .feedback-review-grid {
    grid-template-columns: 1fr;
  }
  .feedback-reading {
    padding: 16px;
  }
  .feedback-resolution {
    position: static;
  }
}
</style>
