<script setup>
import { onMounted, ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
import MathText from '../content/MathText.vue'
const data = ref(null),
  q = ref(''),
  loading = ref(false),
  error = ref(''),
  removing = ref('')
let revision = 0
async function load(page = 1) {
  const request = ++revision
  loading.value = true
  error.value = ''
  try {
    const result = await apiRequest(
      '/api/v1/users/me/mistakes?' + new URLSearchParams({ q: q.value, page }),
    )
    if (request === revision) data.value = result
  } catch (e) {
    if (request === revision) error.value = e.message
  } finally {
    if (request === revision) loading.value = false
  }
}
async function remove(number) {
  if (removing.value) return
  if (!window.confirm('将这道题移出错题本？之后仍可重新加入。')) return
  removing.value = number
  error.value = ''
  try {
    await apiRequest(`/api/v1/users/me/mistakes/${encodeURIComponent(number)}`, {
      method: 'DELETE',
    })
    await load(data.value.page)
  } catch (e) {
    error.value = e.message
  } finally {
    removing.value = ''
  }
}
onMounted(() => load())
</script>
<template>
  <section
    id="account-profile-mistakes-panel"
    class="mistakes-panel"
    role="tabpanel"
    aria-labelledby="account-profile-mistakes-tab"
  >
    <header>
      <div>
        <h2>我的错题</h2>
        <p>集中回看需要巩固的题目，仅自己可见。</p>
      </div>
      <span>{{ data?.total ?? 0 }} 题</span>
    </header>
    <form @submit.prevent="load(1)">
      <input
        v-model.trim="q"
        type="search"
        maxlength="160"
        placeholder="搜索题号或标题"
        aria-label="搜索错题"
      /><button :disabled="loading">搜索</button>
    </form>
    <p v-if="error" role="alert">{{ error }} <button @click="load()">重试</button></p>
    <p v-if="loading" role="status">正在加载错题…</p>
    <template v-else-if="data"
      ><article v-for="entry in data.items" :key="entry.problem.id">
        <header>
          <RouterLink :to="{ name: 'question', params: { problemNumber: entry.problem.id } }"
            ><strong>{{ entry.problem.id }}</strong> · {{ entry.problem.title }}</RouterLink
          ><span>{{ new Date(entry.addedAt).toLocaleDateString('zh-CN') }} 加入</span>
        </header>
        <MathText :text="entry.problem.content" /><img
          v-for="asset in entry.problem.assets"
          :key="asset.url"
          :src="asset.url"
          :alt="asset.altText"
          loading="lazy"
        />
        <footer>
          <RouterLink :to="{ name: 'question', params: { problemNumber: entry.problem.id } }"
            >重新练习 →</RouterLink
          ><button :disabled="!!removing" @click="remove(entry.problem.id)">
            {{ removing === entry.problem.id ? '正在移除…' : '移出错题' }}
          </button>
        </footer>
      </article>
      <p v-if="!data.items.length" class="mistakes-empty">
        {{ q ? '没有找到匹配的错题。' : '还没有错题。打开题目，点击“加入错题”即可收录。' }}
      </p>
      <nav v-if="data.total" aria-label="错题分页">
        <button :disabled="data.page <= 1" @click="load(data.page - 1)">上一页</button
        ><span>{{ data.page }} / {{ Math.ceil(data.total / 20) }}</span
        ><button :disabled="data.page * 20 >= data.total" @click="load(data.page + 1)">
          下一页
        </button>
      </nav></template
    >
  </section>
</template>
<style scoped>
.mistakes-panel {
  margin-top: 24px;
  padding: 24px;
  background: white;
  border: 1px solid #cbdbe8;
  border-radius: 6px;
  color: #285775;
}
.mistakes-panel header,
.mistakes-panel footer,
.mistakes-panel nav,
.mistakes-panel form {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.mistakes-panel h2 {
  font-size: 21px;
  margin: 0;
}
.mistakes-panel p,
.mistakes-panel header > span {
  color: #758d9f;
  font-size: 13px;
}
.mistakes-panel form {
  justify-content: flex-start;
  margin: 24px 0;
}
.mistakes-panel input {
  flex: 1;
  min-width: 150px;
  max-width: 500px;
  border: 1px solid #cbdbe8;
  padding: 10px;
  border-radius: 5px;
  font: inherit;
}
.mistakes-panel button {
  font: inherit;
  font-size: 13px;
  padding: 8px 14px;
  border: 1px solid #cbdbe8;
  background: white;
  color: #205b87;
  border-radius: 5px;
  cursor: pointer;
}
.mistakes-panel button:disabled {
  opacity: 0.5;
  cursor: default;
}
.mistakes-panel a {
  color: #205b87;
  text-decoration: none;
}
.mistakes-panel a:hover {
  text-decoration: underline;
}
.mistakes-panel article {
  border-top: 1px solid #dce6ed;
  padding: 24px 0;
  overflow-wrap: anywhere;
}
.mistakes-panel article > header {
  margin-bottom: 20px;
  font-size: 14px;
}
.mistakes-panel article > footer {
  margin-top: 20px;
  font-size: 14px;
}
.mistakes-panel img {
  display: block;
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  margin: 15px auto;
}
.mistakes-panel nav {
  justify-content: center;
  margin-top: 20px;
}
.mistakes-empty {
  padding: 35px 0;
  text-align: center;
}
@media (max-width: 600px) {
  .mistakes-panel {
    padding: 16px;
  }
}
</style>
