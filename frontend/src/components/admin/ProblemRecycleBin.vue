<script setup>
import { onMounted, ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
const rows = ref([]),
  total = ref(0),
  page = ref(1),
  keyword = ref(''),
  busy = ref(false),
  message = ref('')
async function load() {
  const data = await apiRequest(
    `/api/v1/admin/problem-trash?${new URLSearchParams({ keyword: keyword.value, page: page.value })}`,
  )
  rows.value = data.items
  total.value = data.total
  const lastPage = Math.max(1, Math.ceil(total.value / 40))
  if (page.value > lastPage) {
    page.value = lastPage
    return load()
  }
}
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
async function restore(entry) {
  if (
    !confirm(
      `恢复 ${entry.number || entry.id} · ${entry.title} 到${entry.kind === 'draft' ? '初审队列（不直接发布）' : '公开题库'}？`,
    )
  )
    return
  await run(async () => {
    await apiRequest(
      `/api/v1/admin/problem-trash/${entry.kind === 'draft' ? 'drafts/' : ''}${entry.id}/restore`,
      { method: 'POST' },
    )
    await load()
    message.value = '已恢复'
  })
}
async function purge(entry) {
  const number = prompt(`彻底删除 ${entry.id} · ${entry.title}？此操作不能恢复。请输入题号确认：`)
  if (number === null) return
  if (number !== entry.id) {
    message.value = '题号不一致，未删除'
    return
  }
  await run(async () => {
    await apiRequest(`/api/v1/admin/problem-trash/${entry.id}`, {
      method: 'DELETE',
      body: { number },
    })
    await load()
    message.value = '已彻底删除内容，题号不再使用'
  })
}
onMounted(() => run(load))
</script>
<template>
  <section class="recycle-bin" aria-label="题目回收站">
    <h3>回收站</h3>
    <p>初审草稿恢复到审核队列；已发布题目恢复到公开题库，保留原题号。</p>
    <form
      class="editorial-filters"
      @submit.prevent="
        () => {
          page = 1
          run(load)
        }
      "
    >
      <input v-model="keyword" aria-label="搜索回收站" placeholder="题号或标题" /><button
        :disabled="busy"
      >
        搜索
      </button>
    </form>
    <p v-if="message" role="status">{{ message }}</p>
    <div v-for="entry in rows" :key="`${entry.kind}:${entry.id}`" class="editorial-paper-row">
      <span
        >{{ entry.kind === 'draft' ? '初审草稿' : '已发布' }} · {{ entry.number || entry.id }} ·
        {{ entry.title }}</span
      ><button :disabled="busy" @click="restore(entry)">恢复</button
      ><button v-if="entry.kind !== 'draft'" :disabled="busy" @click="purge(entry)">
        彻底删除
      </button>
    </div>
    <p v-if="!rows.length && !busy">回收站为空或没有匹配题目</p>
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
        上一页</button
      ><span>{{ page }} · 共 {{ total }} 题</span
      ><button
        :disabled="busy || page * 40 >= total"
        @click="
          () => {
            page++
            run(load)
          }
        "
      >
        下一页
      </button>
    </div>
  </section>
</template>
