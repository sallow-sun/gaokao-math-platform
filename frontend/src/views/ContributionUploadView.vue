<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../services/apiClient.js'
import { authService } from '../services/authService.js'
import MathText from '../components/content/MathText.vue'
const router = useRouter()
const user = ref(null),
  busy = ref(false),
  error = ref(''),
  sent = ref(false)
const form = ref({
  title: '',
  year: null,
  source: '',
  type: 'single-choice',
  content: '',
  answer: '',
  solution: '',
})
onMounted(async () => {
  try {
    const auth = await authService.me()
    if (!auth.authenticated) {
      await router.replace({ name: 'login', query: { redirect: '/contribute' } })
      return
    }
    user.value = auth.user
  } catch (e) {
    error.value = e.message
  }
})
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await apiRequest('/api/v1/users/me/contributions', { method: 'POST', body: form.value })
    sent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <main class="community-upload">
    <RouterLink
      v-if="user"
      :to="{ name: 'user-profile', params: { userId: user.id }, query: { tab: 'contributions' } }"
      >← 返回社区贡献</RouterLink
    >
    <section class="community-upload-card">
      <h1>上传题目</h1>
      <p>提交题干、答案与解析，审核采纳后进入公开题库，并记入你的社区贡献。</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <div v-if="sent" role="status">
        <h2>题目已提交，等待审核</h2>
        <p>你可以返回社区贡献查看处理进度。</p>
      </div>
      <form v-else-if="user" @submit.prevent="submit">
        <fieldset :disabled="busy">
          <label
            >题目名称<input
              v-model="form.title"
              required
              maxlength="255"
              placeholder="例如：2025 年新高考Ⅰ卷 · 第 8 题"
          /></label>
          <div class="community-upload-grid">
            <label
              >题型<select v-model="form.type">
                <option value="single-choice">单选题</option>
                <option value="multiple-choice">多选题</option>
                <option value="fill-blank">填空题</option>
                <option value="solution">解答题</option>
              </select></label
            ><label
              >年份（选填）<input v-model.number="form.year" type="number" min="1900" max="2100"
            /></label>
          </div>
          <label
            >来源（选填）<input
              v-model="form.source"
              maxlength="255"
              placeholder="填写试卷名称或标注原创" /></label
          ><label
            >题干<textarea
              v-model="form.content"
              required
              maxlength="30000"
              rows="8"
              placeholder="粘贴题干和选项，公式支持 $...$ 或 $$...$$。"
            /></label
          ><label>答案（选填）<textarea v-model="form.answer" maxlength="30000" rows="3" /></label
          ><label
            >解析（选填）<textarea v-model="form.solution" maxlength="50000" rows="5" />
          </label>
          <details v-if="form.content">
            <summary>预览题干排版</summary>
            <MathText :text="form.content" />
          </details>
          <button class="community-primary">{{ busy ? '正在提交…' : '提交审核' }}</button>
        </fieldset>
      </form>
    </section>
  </main>
</template>
<style scoped>
.community-upload {
  max-width: 860px;
  margin: 32px auto;
  padding: 0 20px 80px;
  color: var(--color-ink);
  font-family: var(--font-ui);
}
.community-upload > a {
  font-size: 14px;
  color: var(--color-blue-800);
}
.community-upload-card {
  margin-top: 20px;
  padding: 28px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 5px;
}
.community-upload h1 {
  font-size: 24px;
  margin: 0;
}
.community-upload p {
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-ink-muted);
}
fieldset {
  border: 0;
  padding: 0;
  margin: 24px 0 0;
  display: grid;
  gap: 18px;
  min-width: 0;
}
label {
  display: grid;
  gap: 8px;
  font-size: 14px;
}
input,
textarea,
select {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 10px;
  color: var(--color-ink);
  background: white;
}
textarea {
  resize: vertical;
  line-height: 1.7;
}
.community-upload-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
details {
  font-size: 14px;
}
summary {
  cursor: pointer;
  color: var(--color-blue-800);
}
button {
  justify-self: start;
  font: inherit;
  font-size: 14px;
  border: 0;
  border-radius: 4px;
  padding: 11px 22px;
  background: var(--color-blue-800);
  color: white;
  cursor: pointer;
}
@media (max-width: 600px) {
  .community-upload-card {
    padding: 20px;
  }
  .community-upload-grid {
    grid-template-columns: 1fr;
  }
}
</style>
