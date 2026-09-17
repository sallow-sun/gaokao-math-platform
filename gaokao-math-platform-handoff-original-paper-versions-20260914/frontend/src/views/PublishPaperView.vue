<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../services/apiClient.js'
import { readPapers } from '../services/paperLibrary.js'
import '../assets/styles/shared-papers.css'
const route = useRoute(),
  router = useRouter()
const kind = ref(route.query.kind === 'PDF' ? 'PDF' : 'BUILDER'),
  papers = ref([]),
  draftId = ref(String(route.query.draft || ''))
const title = ref(''),
  description = ref(''),
  source = ref(''),
  year = ref(''),
  examMode = ref(''),
  hasAnswers = ref(false),
  file = ref(null)
const ready = ref(false),
  pdfAvailable = ref(false),
  busy = ref(false),
  error = ref(''),
  status = ref(''),
  pending = ref(null)
const selected = computed(() => papers.value.find((p) => p.id === draftId.value))
function pickDraft() {
  title.value = selected.value?.draft.title || ''
}
function pickFile(event) {
  file.value = event.target.files?.[0] || null
  pending.value = null
  if (!title.value && file.value) title.value = file.value.name.replace(/\.pdf$/i, '').slice(0, 100)
}
onMounted(async () => {
  try {
    const auth = await apiRequest('/api/v1/auth/me')
    if (!auth.authenticated) return
    const result = await apiRequest('/api/v1/papers')
    pdfAvailable.value = result.pdfAvailable
    papers.value = readPapers().filter((p) => !p.deletedAt && p.draft.items.length)
    if (!draftId.value) draftId.value = papers.value[0]?.id || ''
    if (kind.value === 'BUILDER') pickDraft()
    ready.value = true
  } catch (e) {
    error.value = e.message
  }
})
async function publish() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const body = {
      title: title.value,
      description: description.value,
      source: source.value,
      year: year.value ? Number(year.value) : null,
      examMode: examMode.value,
      hasAnswers: hasAnswers.value,
    }
    let result
    if (kind.value === 'BUILDER') {
      if (!selected.value) throw new Error('请先在组卷中创建一份包含题目的试卷')
      result = await apiRequest('/api/v1/papers/share', {
        method: 'POST',
        body: { ...body, snapshot: selected.value.draft },
      })
    } else {
      if (!pending.value) {
        if (
          !file.value ||
          file.value.size > 25 * 1024 * 1024 ||
          new TextDecoder().decode(await file.value.slice(0, 5).arrayBuffer()) !== '%PDF-'
        )
          throw new Error('请选择不超过 25 MB 的 PDF 文件')
        status.value = '正在准备上传…'
        const ticket = await apiRequest('/api/v1/papers/uploads', { method: 'POST', body })
        const form = new FormData()
        Object.entries(ticket.upload.fields).forEach(([k, v]) => form.append(k, v))
        form.append('file', file.value)
        status.value = '正在上传 PDF，请保持页面打开…'
        const response = await fetch(ticket.upload.url, {
          method: 'POST',
          body: form,
          credentials: 'omit',
          signal: AbortSignal.timeout(180000),
        })
        if (!response.ok) throw new Error('文件上传失败，请稍后重试')
        pending.value = ticket.id
      }
      status.value = '正在核验文件并发布…'
      result = await apiRequest(`/api/v1/papers/${pending.value}/complete`, { method: 'POST' })
    }
    await router.push({ name: 'shared-paper', params: { id: result.id } })
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
    status.value = ''
  }
}
</script>
<template>
  <main class="shared-papers-page shared-form-page">
    <RouterLink :to="{ name: 'papers' }">← 返回试卷库</RouterLink>
    <header class="shared-page-heading">
      <div>
        <h1>分享一份试卷</h1>
        <p>让认真整理的试卷，帮助更多同学。</p>
      </div>
    </header>
    <p v-if="error" class="shared-error" role="alert">{{ error }}</p>
    <p v-if="!ready">
      <RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }"
        >登录后发布试卷</RouterLink
      >
    </p>
    <form v-if="ready" class="shared-panel shared-publish-form" @submit.prevent="publish">
      <fieldset :disabled="busy || !!pending">
        <legend>试卷内容</legend>
        <div class="shared-tabs">
          <button type="button" :aria-pressed="kind === 'BUILDER'" @click="kind = 'BUILDER'">
            分享站内组卷</button
          ><button type="button" :aria-pressed="kind === 'PDF'" @click="kind = 'PDF'">
            上传 PDF
          </button>
        </div>
        <template v-if="kind === 'BUILDER'"
          ><label
            >选择组卷<select v-model="draftId" required @change="pickDraft">
              <option disabled value="">请选择组卷</option>
              <option v-for="paper in papers" :key="paper.id" :value="paper.id">
                {{ paper.draft.title }} · {{ paper.draft.items.length }} 题
              </option>
            </select></label
          >
          <p v-if="!papers.length">
            此浏览器中还没有可分享的组卷。<RouterLink :to="{ name: 'paper-library' }"
              >去创建组卷 →</RouterLink
            >
          </p>
          <p class="shared-muted">
            发布的是当前试卷副本，之后修改自己的草稿不会影响已发布试卷。
          </p></template
        >
        <template v-else
          ><p v-if="!pdfAvailable" class="shared-notice">PDF 上传暂未开放，可先分享站内组卷。</p>
          <label
            >PDF 文件（最大 25 MB）<input
              type="file"
              accept="application/pdf,.pdf"
              :disabled="!pdfAvailable"
              @change="pickFile" /></label
          ><label class="shared-check"
            ><input v-model="hasAnswers" type="checkbox" />文件包含答案或解析</label
          ></template
        >
        <label
          >试卷名称<input
            v-model.trim="title"
            required
            maxlength="100"
            placeholder="例如：2026 高三数学综合练习（一）"
        /></label>
        <div class="shared-form-row">
          <label
            >年份<input
              v-model="year"
              type="number"
              min="1900"
              max="2100"
              placeholder="可选" /></label
          ><label
            >适用考试<select v-model="examMode">
              <option value="">暂不选择</option>
              <option>新高考Ⅰ卷</option>
              <option>新高考Ⅱ卷</option>
              <option>地方卷</option>
              <option>其他</option>
            </select></label
          >
        </div>
        <label
          >来源<input
            v-model.trim="source"
            maxlength="160"
            placeholder="学校、地区或原创说明（可选）" /></label
        ><label
          >试卷说明<textarea
            v-model.trim="description"
            rows="4"
            maxlength="2000"
            placeholder="介绍适合的学习阶段、考查范围与使用建议"
          />
        </label>
      </fieldset>
      <p class="shared-muted">
        请分享你有权公开的内容，并检查姓名、联系方式等个人信息。发布后所有用户均可查看。
      </p>
      <p v-if="status" role="status">{{ status }}</p>
      <footer class="shared-actions">
        <RouterLink :to="{ name: 'papers' }">返回</RouterLink
        ><button class="primary" :disabled="busy || (kind === 'PDF' && !pdfAvailable)">
          {{ busy ? '正在发布…' : pending ? '重试完成发布' : '发布试卷' }}
        </button>
      </footer>
    </form>
  </main>
</template>
