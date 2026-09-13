<script setup>
import { computed, ref, watch } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
const props = defineProps({ userId: { type: String, required: true } })
const levels = [
  ['red', 'RED', '#a34c43'],
  ['orange', 'ORANGE', '#ba7a52'],
  ['yellow', 'YELLOW', '#9a792d'],
  ['green', 'GREEN', '#6b8a60'],
  ['cyan', 'CYAN', '#5c8086'],
  ['blue', 'BLUE', '#566b8c'],
  ['purple', 'PURPLE', '#765c82'],
  ['black', 'BLACK', '#252a30'],
  ['white', 'WHITE', '#788692'],
  ['unknown', '未分级', '#7d8992'],
]
const data = ref(null),
  items = ref([]),
  selected = ref(''),
  q = ref(''),
  applied = ref(''),
  busy = ref(false),
  error = ref('')
let revision = 0
const counts = computed(() =>
  Object.fromEntries((data.value?.levels || []).map((entry) => [entry.level, Number(entry.count)])),
)
const completed = computed(() => Object.values(counts.value).reduce((a, b) => a + b, 0))
const groups = computed(() =>
  levels
    .map(([level, label, color]) => ({
      level,
      label,
      color,
      items: items.value.filter((item) => item.level === level),
    }))
    .filter((group) => group.items.length),
)
async function load(more = false) {
  const request = ++revision
  busy.value = true
  error.value = ''
  if (!more) items.value = []
  try {
    const result = await apiRequest(
      `/api/v1/users/${props.userId}/problem-statistics?` +
        new URLSearchParams({
          q: applied.value,
          level: selected.value,
          page: more ? (data.value?.page || 1) + 1 : 1,
        }),
    )
    if (request !== revision) return
    data.value = result
    items.value = [
      ...new Map(
        [...(more ? items.value : []), ...result.items].map((item) => [item.id, item]),
      ).values(),
    ]
  } catch (e) {
    if (request === revision) error.value = e.message
  } finally {
    if (request === revision) busy.value = false
  }
}
function filter(level) {
  selected.value = level
  load()
}
function search() {
  applied.value = q.value.trim()
  load()
}
watch(
  () => props.userId,
  () => {
    data.value = null
    selected.value = ''
    q.value = ''
    applied.value = ''
    load()
  },
  { immediate: true },
)
</script>
<template>
  <section class="profile-problem-statistics" aria-label="题目统计">
    <div class="profile-completed-list">
      <header>
        <div>
          <h2>
            已做题目 <span>{{ completed }} 题</span>
          </h2>
          <p>按当前难度分组，点击题号即可回看。</p>
        </div>
      </header>
      <form @submit.prevent="search">
        <input
          v-model="q"
          type="search"
          maxlength="160"
          placeholder="搜索题号或标题"
          aria-label="搜索已做题目"
        /><button :disabled="busy">搜索</button>
      </form>
      <p v-if="selected || applied" class="profile-stat-filter">
        {{ selected ? levels.find((item) => item[0] === selected)?.[1] : '全部难度' }} · 找到
        {{ data?.total ?? 0 }} 题
      </p>
      <p v-if="error" role="alert">{{ error }} <button @click="load()">重试</button></p>
      <p v-if="busy && !items.length" role="status">正在加载题目统计…</p>
      <div
        v-for="group in groups"
        :key="group.level"
        class="profile-number-group"
        :style="{ '--level-ink': group.color }"
      >
        <h3>
          <span class="profile-level-badge" :data-level="group.level">{{ group.label }}</span
          ><small>已显示 {{ group.items.length }} 题</small>
        </h3>
        <div class="profile-number-links">
          <RouterLink
            v-for="problem in group.items"
            :key="problem.id"
            :to="{ name: 'question', params: { problemNumber: problem.id } }"
            :title="problem.title"
            :aria-label="`${problem.id}：${problem.title}`"
            >{{ problem.id }}</RouterLink
          >
        </div>
      </div>
      <p v-if="!busy && !error && !items.length" class="profile-stat-empty">
        {{
          selected || applied
            ? '没有匹配的已做题目。'
            : '还没有标记已做的题目。完成练习后，可以在题目页点击“标记已做”。'
        }}
      </p>
      <footer>
        <span>统计依据为“标记已做”，不含已下架题目。</span
        ><button
          v-if="data && data.page * data.pageSize < data.total"
          :disabled="busy"
          @click="load(true)"
        >
          {{ busy ? '加载中…' : '显示更多题号' }}
        </button>
      </footer>
    </div>
    <aside class="profile-level-summary" aria-label="难度统计">
      <h2>难度统计</h2>
      <button class="profile-level-row" :aria-pressed="!selected" @click="filter('')">
        <strong>全部已做</strong><span>{{ completed }} 题</span></button
      ><button
        v-for="[level, label, color] in levels"
        :key="level"
        class="profile-level-row"
        :aria-pressed="selected === level"
        :style="{ '--level-ink': color }"
        @click="filter(level)"
      >
        <span class="profile-level-badge" :data-level="level">{{ label }}</span
        ><span>{{ counts[level] || 0 }} 题</span>
      </button>
      <p>点击难度查看对应题目</p>
    </aside>
  </section>
</template>
<style scoped>
.profile-problem-statistics {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  gap: 20px;
  align-items: start;
  margin: 20px 0;
  color: #365a78;
}
.profile-completed-list,
.profile-level-summary {
  min-width: 0;
  border: 1px solid #cbd6e0;
  border-radius: 5px;
  background: #fff;
  padding: 22px;
}
.profile-problem-statistics h2 {
  font-size: 18px;
  color: #173c58;
  margin: 0 0 10px;
}
.profile-problem-statistics h2 > span {
  font-size: 13px;
  font-weight: normal;
  color: #7d909f;
  margin-left: 10px;
}
.profile-problem-statistics p {
  font-size: 12px;
  color: #7d909f;
  line-height: 1.8;
}
.profile-completed-list form {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}
.profile-completed-list input {
  min-width: 0;
  flex: 1;
  font: inherit;
  font-size: 13px;
  padding: 9px 12px;
  border: 1px solid #cbd6e0;
  border-radius: 4px;
}
.profile-completed-list button {
  border: 1px solid #cbd6e0;
  border-radius: 4px;
  background: #fff;
  padding: 8px 13px;
  color: #205b87;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.profile-completed-list button:disabled {
  opacity: 0.5;
  cursor: default;
}
.profile-number-group {
  margin: 24px 0;
}
.profile-number-group h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
}
.profile-number-group h3 small {
  font-size: 11px;
  font-weight: normal;
  color: #8b9ba7;
}
.profile-level-badge {
  display: inline-block;
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 600;
  background: var(--level-ink);
  color: white;
  border: 1px solid var(--level-ink);
  border-radius: 3px;
  line-height: 1.3;
}
.profile-level-badge[data-level='white'] {
  background: white;
  color: #657483;
}
.profile-number-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}
.profile-number-links a {
  color: var(--level-ink);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  text-decoration: none;
  line-height: 1.7;
}
.profile-number-links a:hover {
  text-decoration: underline;
}
.profile-completed-list footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid #e2e8ed;
  padding-top: 16px;
  font-size: 11px;
  color: #8b9ba7;
}
.profile-level-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  font: inherit;
  font-size: 12px;
  padding: 10px 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: white;
  color: #748b9a;
  cursor: pointer;
  text-align: left;
}
.profile-level-row[aria-pressed='true'] {
  background: #edf4f8;
  border-color: #c5d9e7;
}
.profile-level-row:hover {
  background: #f3f7fa;
}
.profile-level-summary > p {
  margin-bottom: 0;
}
.profile-stat-empty {
  padding: 30px 0;
}
.profile-problem-statistics :focus-visible {
  outline: 2px solid #2c6a97;
  outline-offset: 3px;
}
@media (max-width: 750px) {
  .profile-problem-statistics {
    grid-template-columns: minmax(0, 1fr);
  }
  .profile-level-summary {
    order: -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3px 12px;
    padding: 16px;
  }
  .profile-level-summary h2,
  .profile-level-summary > p {
    grid-column: 1/-1;
  }
  .profile-completed-list {
    padding: 16px;
  }
}
</style>
