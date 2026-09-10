<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCurriculumCatalog } from '../../services/curriculumService.js'

const route = useRoute(),
  router = useRouter()
const catalog = ref(null),
  error = ref(''),
  message = ref('')
const editing = ref(''),
  draft = ref([]),
  book = ref(''),
  panel = ref(null)
let trigger
const values = (value) => (Array.isArray(value) ? value : value ? [value] : [])
const enabled = computed(() => route.query.learning === 'true')
const learned = computed(() => values(route.query.learned))
const focus = computed(() => values(route.query.chapter))
const preset = computed(() => {
  const p = catalog.value?.presets.find((p) => p.id === route.query.progress)
  return p &&
    p.chapters.length === learned.value.length &&
    p.chapters.every((c) => learned.value.includes(c))
    ? p.id
    : ''
})
const books = computed(() => [...new Set((catalog.value?.chapters || []).map((c) => c.book))])
const visibleChapters = computed(
  () => catalog.value?.chapters.filter((c) => c.book === book.value) || [],
)
watch(
  () => route.query,
  () => {
    editing.value = ''
    message.value = ''
  },
)
onMounted(async () => {
  try {
    catalog.value = await getCurriculumCatalog()
    book.value = books.value[0]
  } catch (e) {
    error.value = e.message
  }
})
function apply(changes) {
  const query = { ...route.query, ...changes }
  delete query.page
  if (query.learning === 'true') {
    try {
      localStorage.setItem(
        'mathsea:learning:PEP-A-2019',
        JSON.stringify({ learned: values(query.learned) }),
      )
    } catch {
      /* Optional browser preference. */
    }
  }
  router.push({ name: 'problems', query })
  close()
}
function choosePreset(p) {
  apply({ learning: p ? 'true' : undefined, learned: p?.chapters, progress: p?.id })
}
async function open(kind, event) {
  if (editing.value === kind) {
    close()
    return
  }
  trigger = event.currentTarget
  editing.value = kind
  draft.value = [...(kind === 'learning' ? learned.value : focus.value)]
  message.value = ''
  await nextTick()
  panel.value?.querySelector('button')?.focus()
}
function close() {
  editing.value = ''
  trigger?.focus()
}
function confirm() {
  apply(
    editing.value === 'learning'
      ? { learning: 'true', learned: [...draft.value], progress: undefined }
      : { chapter: draft.value.length ? [...draft.value] : undefined },
  )
}
function toggleBook() {
  const codes = visibleChapters.value.map((c) => c.code)
  draft.value = codes.every((c) => draft.value.includes(c))
    ? draft.value.filter((c) => !codes.includes(c))
    : [...new Set([...draft.value, ...codes])]
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem('mathsea:learning:PEP-A-2019') || 'null')
    if (!Array.isArray(saved?.learned)) {
      message.value = '本机还没有保存过学习进度'
      return
    }
    draft.value = saved.learned.filter((code) =>
      catalog.value.chapters.some((c) => c.code === code),
    )
    message.value = '已载入上次进度，确认后应用。'
  } catch {
    message.value = '无法读取本机保存的进度'
  }
}
</script>

<template>
  <template v-if="catalog">
    <div class="bank-filter-group" role="group" aria-labelledby="learning-label">
      <span id="learning-label" class="bank-filter-group-label">学习进度</span>
      <div class="bank-filter-options">
        <button type="button" :aria-pressed="!enabled" @click="choosePreset(null)">全部</button>
        <button
          v-for="p in catalog.presets"
          :key="p.id"
          type="button"
          :aria-pressed="enabled && preset === p.id"
          :title="`${p.label} · ${p.chapters.length} 章`"
          @click="choosePreset(p)"
        >
          {{ p.label.replace(/^学完/, '') }}
        </button>
        <button
          type="button"
          class="bank-filter-more"
          :class="{ 'is-active': enabled && !preset }"
          :aria-expanded="editing === 'learning'"
          aria-controls="curriculum-detail"
          @click="open('learning', $event)"
        >
          {{ enabled && !preset ? `自定义 · ${learned.length} 章` : '自定义' }}
        </button>
      </div>
    </div>
    <p v-if="focus.length" class="curriculum-note">
      此链接还包含旧版章节筛选。<button type="button" @click="apply({ chapter: undefined })">
        清除章节条件
      </button>
    </p>
    <div
      v-if="editing"
      id="curriculum-detail"
      ref="panel"
      class="curriculum-detail"
      role="region"
      :aria-label="editing === 'learning' ? '自定义学习进度' : '选择教材章节'"
      @keydown.esc.stop.prevent="close"
    >
      <header class="curriculum-heading">
        <div>
          <h3>{{ editing === 'learning' ? '选择已学章节' : '选择专项章节' }}</h3>
          <p>
            {{
              editing === 'learning'
                ? '优先按已确认章节筛选；未确认时按 TAG 对应的完整章节范围估计，可能少选。'
                : '查找涉及任一所选章节的题目，可与学习进度叠加。'
            }}
          </p>
        </div>
        <button type="button" class="curriculum-close" aria-label="关闭章节选择" @click="close">
          ×
        </button>
      </header>
      <div class="curriculum-books" aria-label="教材分册">
        <button
          v-for="b in books"
          :key="b"
          type="button"
          :aria-pressed="book === b"
          @click="book = b"
        >
          {{ b
          }}<span
            v-if="catalog.chapters.some((c) => c.book === b && draft.includes(c.code))"
            class="curriculum-dot"
            aria-label="有已选章节"
          ></span>
        </button>
      </div>
      <div class="curriculum-chapters">
        <label
          v-for="c in visibleChapters"
          :key="c.code"
          :class="{ 'is-selected': draft.includes(c.code) }"
          ><input v-model="draft" type="checkbox" :value="c.code" /><span>{{
            c.title.replace(/^第[一二三四五六七八九十]+章\s*/, '')
          }}</span
          ><small class="sr-only">{{ c.code }}</small></label
        >
      </div>
      <footer class="curriculum-footer">
        <div class="curriculum-tools">
          <span>已选 {{ draft.length }} 章</span
          ><button type="button" @click="toggleBook">
            {{
              visibleChapters.every((c) => draft.includes(c.code)) ? '取消本册' : '全选本册'
            }}</button
          ><button type="button" @click="draft = []">清空</button
          ><button v-if="editing === 'learning'" type="button" @click="restore">上次进度</button>
        </div>
        <div class="curriculum-actions">
          <button type="button" @click="close">取消</button
          ><button
            type="button"
            class="curriculum-apply"
            :disabled="!draft.length"
            @click="confirm"
          >
            应用筛选
          </button>
        </div>
      </footer>
      <p v-if="!draft.length" class="curriculum-note">请选择已学章节</p>
      <p v-if="message" class="curriculum-note" role="status">{{ message }}</p>
    </div>
  </template>
  <p v-if="error" class="curriculum-error" role="alert">
    教材目录加载失败，请刷新重试：{{ error }}
  </p>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.curriculum-apply:disabled {
  opacity: 0.45;
  cursor: default;
}
.curriculum-edition {
  margin-left: auto;
  color: var(--color-ink-muted);
  font-size: 12px;
  padding: 0 12px;
}
.bank-filter-options .curriculum-focus {
  white-space: normal;
  text-align: left;
}
.curriculum-detail {
  padding: 22px 24px 18px 120px;
  background: #f7f9fc;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-ink-secondary);
}
.curriculum-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.curriculum-heading h3 {
  margin: 0;
  font-size: 15px;
  color: var(--color-ink-primary);
}
.curriculum-heading p,
.curriculum-note {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-ink-muted);
}
.curriculum-detail button {
  font: inherit;
  cursor: pointer;
}
.curriculum-close {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 24px !important;
  width: 32px;
  height: 32px;
}
.curriculum-books {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin-top: 18px;
  border-bottom: 1px solid var(--color-border);
}
.curriculum-books button {
  position: relative;
  padding: 10px 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-ink-muted);
  font-size: 13px;
}
.curriculum-books button[aria-pressed='true'] {
  border-bottom-color: #175582;
  color: #124c77;
  font-weight: 700;
}
.curriculum-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin: 0 0 2px 5px;
  border-radius: 50%;
  background: #39749d;
}
.curriculum-chapters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
  padding: 16px 0;
}
.curriculum-chapters label {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.6;
  cursor: pointer;
}
.curriculum-chapters label:hover {
  background: #edf2f7;
}
.curriculum-chapters label.is-selected {
  background: #e9f1f8;
  border-color: #cbdce9;
  color: #124c77;
}
.curriculum-chapters input {
  accent-color: #175582;
  flex: 0 0 auto;
}
.curriculum-chapters small {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-ink-muted);
}
.curriculum-footer,
.curriculum-tools,
.curriculum-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.curriculum-footer {
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
}
.curriculum-tools {
  font-size: 12px;
  color: var(--color-ink-muted);
}
.curriculum-tools button {
  border: 0;
  padding: 5px 0;
  background: transparent;
  color: #28618c;
}
.curriculum-actions button {
  padding: 8px 18px;
  border: 1px solid #cbd9e5;
  border-radius: 4px;
  background: white;
  color: #245678;
  font-size: 13px;
}
.curriculum-actions .curriculum-apply {
  color: white;
  border-color: #164f79;
  background: #164f79;
}
.curriculum-detail button:focus-visible,
.curriculum-chapters input:focus-visible {
  outline: 2px solid #3477a7;
  outline-offset: 3px;
}
.curriculum-error {
  padding: 12px 24px;
  font-size: 13px;
}
@media (max-width: 700px) {
  .curriculum-detail {
    padding: 18px 14px;
  }
  .curriculum-chapters {
    grid-template-columns: minmax(0, 1fr);
    gap: 3px;
  }
  .curriculum-books {
    gap: 2px 16px;
  }
  .curriculum-actions {
    margin-left: auto;
  }
  .curriculum-edition {
    padding-right: 0;
  }
}
</style>
