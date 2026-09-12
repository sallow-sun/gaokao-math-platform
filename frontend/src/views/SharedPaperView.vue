<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../services/apiClient.js'
import { createPaper } from '../services/paperLibrary.js'
import MathText from '../components/content/MathText.vue'
import '../assets/styles/shared-papers.css'
const route = useRoute(),
  router = useRouter(),
  paper = ref(null),
  error = ref(''),
  busy = ref(false),
  pdfUrl = ref(''),
  difficulty = ref(3),
  alignment = ref(3),
  note = ref(''),
  saved = ref('')
const id = route.params.id
async function load() {
  try {
    paper.value = await apiRequest(`/api/v1/papers/${id}`)
    const mine = paper.value.myRating?.[0]
    if (mine) {
      difficulty.value = mine.difficulty
      alignment.value = mine.alignment
    }
    note.value = paper.value.check_note || ''
  } catch (e) {
    error.value = e.message
  }
}
async function act(work) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  saved.value = ''
  try {
    await work()
  } catch (e) {
    error.value = e.message
    if (e.status === 401) router.push({ name: 'login', query: { redirect: route.fullPath } })
  } finally {
    busy.value = false
  }
}
function favorite() {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/favorite`, {
      method: 'PUT',
      body: { favorite: !paper.value.favorite },
    })
    await load()
  })
}
function rate() {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/rating`, {
      method: 'PUT',
      body: { difficulty: difficulty.value, alignment: alignment.value },
    })
    await load()
    saved.value = '评价已保存'
  })
}
function check(value) {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/check`, {
      method: 'PUT',
      body: { checked: value, note: note.value },
    })
    await load()
    saved.value = value ? '校核记录已保存' : '已撤销校核'
  })
}
function remove() {
  if (!window.confirm('下架这份试卷？下架后其他用户将无法访问，个人组卷草稿不受影响。')) return
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}`, { method: 'DELETE' })
    router.push({ name: 'papers', query: { scope: 'mine' } })
  })
}
function pdf(download = false) {
  act(async () => {
    const result = await apiRequest(`/api/v1/papers/${id}/access?download=${download}`, {
      method: 'POST',
    })
    if (download) {
      const a = document.createElement('a')
      a.href = result.url
      a.rel = 'noopener'
      a.click()
    } else pdfUrl.value = result.url
  })
}
function copy() {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/access`, { method: 'POST' })
    const created = createPaper(paper.value.snapshot)
    router.push({ name: 'paper', params: { id: created.id } })
  })
}
onMounted(load)
</script>
<template>
  <main class="shared-papers-page">
    <RouterLink :to="{ name: 'papers' }">← 返回试卷库</RouterLink>
    <p v-if="error" role="alert" class="shared-error">
      {{ error }} <button @click="load">重新加载</button>
    </p>
    <template v-if="paper"
      ><header class="shared-page-heading">
        <div>
          <div class="shared-badges">
            <span>{{ paper.kind === 'PDF' ? 'PDF 文件' : '可编辑组卷' }}</span
            ><span v-if="paper.hot" class="shared-hot">HOT</span
            ><span v-if="paper.checked_at">✓ 人工校核</span
            ><span v-if="paper.has_answers">含答案</span>
          </div>
          <h1>{{ paper.title }}</h1>
          <p>
            {{ paper.author }} 分享 · {{ new Date(paper.created_at).toLocaleDateString('zh-CN') }}
          </p>
        </div>
        <button :aria-pressed="paper.favorite" :disabled="busy" @click="favorite">
          {{ paper.favorite ? '已收藏' : '收藏试卷' }} · {{ paper.favorite_count }}
        </button>
      </header>
      <div class="shared-detail-layout">
        <section class="shared-panel shared-preview">
          <header>
            <h2>试卷预览</h2>
            <div class="shared-actions">
              <template v-if="paper.kind === 'PDF'"
                ><button :disabled="busy" @click="pdf(false)">
                  {{ pdfUrl ? '重新加载预览' : '打开预览' }}</button
                ><button class="primary" :disabled="busy" @click="pdf(true)">
                  下载 PDF
                </button></template
              ><template v-else
                ><RouterLink
                  class="shared-button"
                  :to="{ name: 'paper-shared-preview', params: { resourceId: id } }"
                  >预览 / 打印</RouterLink
                ><button class="primary" :disabled="busy" @click="copy">
                  复制到我的组卷
                </button></template
              >
            </div>
          </header>
          <template v-if="paper.kind === 'PDF'"
            ><iframe
              v-if="pdfUrl"
              :src="pdfUrl"
              title="试卷 PDF 预览"
              referrerpolicy="no-referrer"
            />
            <div v-else class="shared-empty">
              <span class="shared-pdf-symbol">PDF</span>
              <h3>按需加载原卷</h3>
              <p>{{ (paper.file_bytes / 1048576).toFixed(1) }} MB · 登录后可预览、下载</p>
              <p>移动端如无法显示预览，可下载后打开。</p>
            </div></template
          >
          <div v-else class="shared-sample-sheet">
            <h2>{{ paper.title }}</h2>
            <p>数学 · {{ paper.question_count }} 题 · {{ paper.total_score }} 分</p>
            <article
              v-for="(item, index) in paper.snapshot.items.slice(0, 3)"
              :key="item.problem.id"
            >
              <div class="shared-muted">
                {{ index + 1 }}. {{ item.problem.typeLabel }} · {{ item.score }} 分
              </div>
              <MathText :text="item.problem.content" /><img
                v-for="asset in item.problem.assets"
                :key="asset.url"
                :src="asset.url"
                :alt="asset.altText"
                loading="lazy"
              />
            </article>
            <RouterLink :to="{ name: 'paper-shared-preview', params: { resourceId: id } }"
              >查看完整试卷与打印排版 →</RouterLink
            >
          </div>
        </section>
        <aside class="shared-detail-aside">
          <section class="shared-panel">
            <h2>试卷信息</h2>
            <dl>
              <dt>来源</dt>
              <dd>{{ paper.source || '未填写' }}</dd>
              <dt>年份</dt>
              <dd>{{ paper.year || '未填写' }}</dd>
              <dt>适用考试</dt>
              <dd>{{ paper.exam_mode || '未填写' }}</dd>
            </dl>
            <p class="shared-description">{{ paper.description || '作者尚未添加说明。' }}</p>
            <div v-if="paper.checked_at" class="shared-notice">
              <strong>已人工校核</strong>
              <p>{{ paper.check_note }}</p>
              <small
                >{{ paper.checked_by_name }} ·
                {{ new Date(paper.checked_at).toLocaleDateString('zh-CN') }}</small
              >
            </div>
            <p v-else class="shared-muted">尚未完成人工校核</p>
          </section>
          <section class="shared-panel">
            <h2>
              读者评价 <small>{{ paper.rating_count }} 人</small>
            </h2>
            <div class="shared-rating-summary">
              <div>
                <strong>{{ paper.rating_count >= 5 ? paper.difficulty : '—' }}</strong
                ><span>难度 / 5</span>
              </div>
              <div>
                <strong>{{ paper.rating_count >= 5 ? paper.alignment : '—' }}</strong
                ><span>高考契合度 / 5</span>
              </div>
            </div>
            <p class="shared-muted">
              难度分越高越难，契合度分越高越贴近高考。满 5 人评价后展示均分。
            </p>
            <form v-if="!paper.canEdit" @submit.prevent="rate">
              <label
                >我认为的难度<select v-model.number="difficulty">
                  <option :value="1">1 · 很容易</option>
                  <option :value="2">2 · 较容易</option>
                  <option :value="3">3 · 中等</option>
                  <option :value="4">4 · 较难</option>
                  <option :value="5">5 · 很难</option>
                </select></label
              ><label
                >与高考的契合度<select v-model.number="alignment">
                  <option v-for="n in 5" :key="n" :value="n">
                    {{ n }} · {{ ['很低', '较低', '一般', '较高', '很高'][n - 1] }}
                  </option>
                </select></label
              ><button :disabled="busy">
                {{ paper.myRating.length ? '更新评价' : '提交评价' }}
              </button>
            </form>
            <p v-else class="shared-muted">作者不能评价自己发布的试卷。</p>
          </section>
          <section v-if="paper.canCheck" class="shared-panel">
            <h2>管理员校核</h2>
            <label
              >已核对的内容<textarea
                v-model="note"
                maxlength="500"
                rows="3"
                placeholder="例如：已逐题核对题干、配图和参考答案"
              />
            </label>
            <div class="shared-actions">
              <button :disabled="busy || !note.trim()" @click="check(true)">记录校核</button
              ><button v-if="paper.checked_at" :disabled="busy" @click="check(false)">撤销</button>
            </div>
          </section>
          <button v-if="paper.canEdit || paper.canCheck" :disabled="busy" @click="remove">
            下架试卷
          </button>
          <p v-if="saved" role="status">{{ saved }}</p>
        </aside>
      </div></template
    >
    <p v-else-if="!error" class="shared-empty">正在加载试卷…</p>
  </main>
</template>
