<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../services/apiClient.js'
import { authService } from '../services/authService.js'
const route = useRoute(),
  router = useRouter()
const number = computed(() => String(route.query.number || ''))
const kind = ref('题干／公式'),
  description = ref(''),
  suggestion = ref(''),
  image = ref(null)
const busy = ref(false),
  message = ref(''),
  sent = ref(false),
  rows = ref([]),
  total = ref(0),
  page = ref(1)
const labels = { OPEN: '待处理', CHANGES: '待修改', RESOLVED: '已解决', DISMISSED: '无需修改' }
async function load() {
  try {
    const data = await apiRequest(`/api/v1/feedback/mine?page=${page.value}`)
    rows.value = data.items
    total.value = data.total
  } catch (e) {
    message.value = e.message
  }
}
async function submit() {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    if (image.value && image.value.size > 5 * 1024 * 1024) throw new Error('截图不能超过5MB')
    const body = new FormData()
    for (const [key, value] of Object.entries({
      number: number.value,
      kind: kind.value,
      description: description.value,
      suggestion: suggestion.value,
    }))
      body.append(key, value)
    if (image.value) body.append('image', image.value)
    await apiRequest('/api/v1/feedback', { method: 'POST', body })
    sent.value = true
    message.value = '反馈已提交，处理结果会显示在下方。'
    await load()
  } catch (e) {
    message.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(async () => {
  try {
    if (!(await authService.me()).authenticated) {
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    await load()
  } catch (e) {
    message.value = e.message
  }
})
</script>
<template>
  <main class="feedback-page">
    <RouterLink :to="number ? `/problems/${number}` : '/problems'"
      >← 返回题库{{ number ? '题目' : '' }}</RouterLink
    >
    <form v-if="number && !sent" class="feedback-paper" @submit.prevent="submit">
      <h1>
        题目反馈 <small>{{ number }}</small>
      </h1>
      <p>请指出具体位置，帮助我们更快核对。</p>
      <label
        >问题类型<select v-model="kind" aria-label="问题类型">
          <option v-for="v in ['题干／公式', '答案', '解析', '图片', '分类', '其他']" :key="v">
            {{ v }}
          </option>
        </select></label
      >
      <label
        >问题描述<textarea
          v-model="description"
          required
          minlength="3"
          maxlength="3000"
          rows="5"
          placeholder="例如：第二小问的答案与解析结论不一致……"
        />
      </label>
      <label>建议修改（选填）<textarea v-model="suggestion" maxlength="3000" rows="3" /></label>
      <label
        >截图（选填，最大5MB）<input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          @change="image = $event.target.files[0] || null"
      /></label>
      <button class="feedback-primary" :disabled="busy">{{ busy ? '提交中…' : '提交反馈' }}</button>
    </form>
    <p v-if="message" role="status">{{ message }}</p>
    <section class="feedback-paper">
      <h2>我的反馈</h2>
      <article v-for="entry in rows" :key="entry.id" class="feedback-entry">
        <header>
          <RouterLink :to="`/problems/${entry.number}`"
            >{{ entry.number }} · {{ entry.title }}</RouterLink
          ><span>{{ labels[entry.status] }}</span>
        </header>
        <p>{{ entry.kind }} · {{ entry.description }}</p>
        <p v-if="entry.response" class="feedback-response">处理说明：{{ entry.response }}</p>
      </article>
      <p v-if="!rows.length">暂时没有反馈记录</p>
      <div class="feedback-actions">
        <button
          :disabled="page <= 1"
          @click="
            () => {
              page--
              load()
            }
          "
        >
          上一页</button
        ><span>{{ page }} · 共 {{ total }} 条</span
        ><button
          :disabled="page * 30 >= total"
          @click="
            () => {
              page++
              load()
            }
          "
        >
          下一页
        </button>
      </div>
    </section>
  </main>
</template>
<style>
.feedback-page {
  max-width: 880px;
  margin: 28px auto;
  padding: 0 18px 90px;
  color: #23435e;
}
.feedback-paper {
  background: #fff;
  border: 1px solid #dce5ed;
  border-radius: 8px;
  padding: 28px;
  margin-top: 20px;
}
.feedback-paper h1 {
  font-size: 24px;
}
.feedback-paper h2 {
  font-size: 20px;
}
.feedback-paper small {
  font-size: 14px;
  font-weight: 400;
}
.feedback-paper label {
  display: grid;
  gap: 8px;
  margin: 20px 0;
}
.feedback-paper :is(input, textarea, select) {
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #bdcedd;
  border-radius: 5px;
  font: inherit;
}
.feedback-paper button {
  padding: 9px 16px;
  border: 1px solid #bdcedd;
  border-radius: 5px;
  background: white;
  color: #24557a;
  cursor: pointer;
}
.feedback-paper .feedback-primary {
  background: #19577f;
  color: white;
}
.feedback-paper button:disabled {
  opacity: 0.5;
}
.feedback-entry {
  padding: 18px 0;
  border-bottom: 1px solid #e6edf3;
  overflow-wrap: anywhere;
}
.feedback-entry header,
.feedback-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.feedback-response {
  background: #f2f7fa;
  padding: 12px;
}
.feedback-actions {
  margin-top: 20px;
}
@media (max-width: 600px) {
  .feedback-paper {
    padding: 18px;
  }
}
</style>
