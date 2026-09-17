<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
import PurgeApprovalDialog from './PurgeApprovalDialog.vue'
const selecting = ref(false),
  selected = ref([]),
  approval = ref(null)
const key = (entry) => `${entry.kind}:${entry.id}`
const allSelected = computed(
  () => rows.value.length > 0 && selected.value.length === rows.value.length,
)
function beginApproval(items) {
  approval.value = items.map((item) => ({ ...item }))
}
function toggleSelection() {
  selecting.value = !selecting.value
  selected.value = []
}
async function purged(count) {
  approval.value = null
  selecting.value = false
  await run(async () => {
    await load()
    message.value = `已彻底删除 ${count} 题，保留题号及操作记录`
  })
}
const rows = ref([]),
  total = ref(0),
  page = ref(1),
  keyword = ref(''),
  busy = ref(false),
  message = ref('')
async function load() {
  selected.value = []
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
    <div class="trash-selection">
      <button
        :disabled="busy || !rows.length"
        @click="toggleSelection"
      >
        {{ selecting ? '取消选择' : '批量彻底删除' }}
      </button>
      <template v-if="selecting">
        <label
          ><input
            type="checkbox"
            :checked="allSelected"
            :disabled="busy"
            @change="selected = $event.target.checked ? rows.map(key) : []"
          />选择当前页</label
        >
        <span>已选 {{ selected.length }} 题</span>
        <button
          :disabled="busy || !selected.length"
          @click="beginApproval(rows.filter((entry) => selected.includes(key(entry))))"
        >
          彻底删除所选
        </button>
      </template>
    </div>
    <div v-for="entry in rows" :key="`${entry.kind}:${entry.id}`" class="editorial-paper-row">
      <input
        v-if="selecting"
        v-model="selected"
        type="checkbox"
        :value="key(entry)"
        :disabled="busy"
        :aria-label="`选择 ${entry.number || entry.title}`"
      />
      <span
        >{{ entry.kind === 'draft' ? '初审草稿' : '已发布' }} · {{ entry.number || entry.id }} ·
        {{ entry.title }}</span
      ><button :disabled="busy" @click="restore(entry)">恢复</button
      ><button :disabled="busy" @click="beginApproval([entry])">彻底删除</button>
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
    <PurgeApprovalDialog
      v-if="approval"
      :items="approval"
      @close="approval = null"
      @purged="purged"
    />
  </section>
</template>
<style scoped>
.trash-selection {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 16px 0;
}
.trash-selection label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.editorial-paper-row > span {
  overflow-wrap: anywhere;
  min-width: 0;
}
</style>
