<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { importPapers, createPaper, readPapers, recyclePaper } from '../services/paperLibrary.js'
const router = useRouter()
const fileInput = ref(null)
async function importBackup(event) {
  const file = event.target.files[0]
  if (!file) return
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('too large')
    importPapers(await file.text())
    refresh()
  } catch {
    error.value = '导入失败，请选择有效的试卷备份文件（不超过 10 MB）。原有试卷未改变。'
  }
  event.target.value = ''
}
const papers = ref([])
const query = ref('')
const trash = ref(false)
const error = ref('')
const visible = computed(() =>
  papers.value
    .filter(
      (p) =>
        Boolean(p.deletedAt) === trash.value &&
        p.draft.title.toLowerCase().includes(query.value.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt),
)
function refresh() {
  try {
    papers.value = readPapers()
    error.value = ''
  } catch {
    error.value = '无法读取此浏览器的试卷，请检查浏览器存储设置后重试。'
  }
}
function open(paper) {
  router.push({ name: 'paper', params: { id: paper.id } })
}
function create(source) {
  try {
    const paper = createPaper(
      source ? { ...source.draft, title: source.draft.title + '（副本）' } : undefined,
    )
    open(paper)
  } catch {
    error.value = '保存失败，浏览器存储空间可能不足，请先导出备份。'
  }
}
function recycle(paper) {
  try {
    recyclePaper(paper.id, trash.value)
    refresh()
  } catch {
    error.value = '操作未保存，请检查浏览器存储后重试。'
  }
}
function backup() {
  const blob = new Blob([JSON.stringify({ version: 1, papers: papers.value }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '我的试卷备份.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function date(value) {
  return new Date(value).toLocaleDateString('zh-CN')
}
function total(paper) {
  return paper.draft.items.reduce((sum, item) => sum + item.score, 0)
}
onMounted(() => {
  refresh()
  window.addEventListener('storage', refresh)
})
onBeforeUnmount(() => window.removeEventListener('storage', refresh))
</script>

<template>
  <main class="paper-library">
    <header class="library-heading">
      <div>
        <p class="library-eyebrow">自主组卷</p>
        <h1>{{ trash ? '回收站' : '我的试卷' }}</h1>
        <p>整理每一份练习，继续上一次的思考。</p>
      </div>
      <div class="library-actions">
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          hidden
          @change="importBackup"
        /><button @click="fileInput.click()">导入</button
        ><button @click="trash = !trash">{{ trash ? '返回书架' : '回收站' }}</button
        ><button :disabled="!papers.length" @click="backup">导出备份</button
        ><button class="primary" @click="create()">＋ 新建试卷</button>
      </div>
    </header>
    <div class="library-toolbar">
      <span>{{ visible.length }} 份试卷 <span class="library-local">· 保存在此浏览器</span></span
      ><input v-model="query" type="search" aria-label="搜索试卷" placeholder="搜索试卷名称…" />
    </div>
    <p v-if="error" role="alert">{{ error }} <button @click="refresh">重试</button></p>
    <section class="library-grid" aria-label="试卷书架">
      <button v-if="!trash" class="library-new" @click="create()">
        <span class="library-plus">＋</span><strong>新建试卷</strong
        ><span>从题库挑选，编排你的试卷</span>
      </button>
      <article v-for="(paper, index) in visible" :key="paper.id" class="library-book">
        <button
          class="library-cover"
          :class="'cover-' + (index % 3)"
          :disabled="trash"
          :aria-label="'打开试卷：' + paper.draft.title"
          @click="open(paper)"
        >
          <span class="cover-subject">MATH · 数学</span><strong>{{ paper.draft.title }}</strong
          ><span class="cover-rule"></span
          ><span class="cover-bottom"
            >{{ paper.draft.items.length }} 题 <span>{{ total(paper) }} 分</span></span
          >
        </button>
        <div class="library-book-info">
          <h2>{{ paper.draft.title }}</h2>
          <p>
            编辑于 {{ date(paper.updatedAt) }} · {{ paper.draft.size === 'a4' ? 'A4' : '16 开' }}
          </p>
          <div class="book-actions">
            <RouterLink
              v-if="!trash && paper.draft.items.length"
              :to="{ name: 'paper-publish', query: { draft: paper.id } }"
              >分享</RouterLink
            >
            <button v-if="!trash" @click="create(paper)">复制</button
            ><button @click="recycle(paper)">{{ trash ? '恢复试卷' : '移入回收站' }}</button>
          </div>
        </div>
      </article>
    </section>
    <p v-if="!visible.length" class="library-empty">
      {{
        trash
          ? '回收站为空。移入这里的试卷可以随时恢复。'
          : query
            ? '没有找到匹配的试卷。'
            : '你的第一份试卷，从这里开始。'
      }}
    </p>
    <p class="library-note">试卷自动保存在当前浏览器中；清理浏览器数据前，请导出备份。</p>
  </main>
</template>

<style scoped>
.paper-library {
  min-height: 100dvh;
  padding: 40px clamp(20px, 4vw, 64px);
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-ui);
}
.library-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 36px;
}
.library-eyebrow {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--color-blue-800);
  margin: 0 0 10px;
}
h1 {
  font-size: 28px;
  margin: 0;
  font-weight: 650;
}
.library-heading p:not(.library-eyebrow) {
  color: var(--color-ink-muted);
  font-size: 13px;
  margin: 12px 0 0;
}
.library-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
button,
input {
  font: inherit;
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: white;
  color: var(--color-ink-secondary);
  padding: 9px 14px;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.65;
}
button:hover:not(:disabled) {
  border-color: var(--color-blue-700);
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--color-blue-700);
  outline-offset: 3px;
}
.primary {
  background: var(--color-blue-800);
  color: white;
  border-color: var(--color-blue-800);
}
.library-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 18px;
  margin-bottom: 28px;
  font-size: 13px;
  color: var(--color-ink-secondary);
}
.library-local,
.library-note {
  color: var(--color-ink-muted);
}
.library-toolbar input {
  width: 240px;
  max-width: 50%;
}
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 28px;
  align-items: stretch;
}
.library-new {
  min-height: 330px;
  border: 1px dashed #a9bfce;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(255, 255, 255, 0.5);
  color: var(--color-blue-800);
}
.library-new > span:last-child {
  font-size: 12px;
  color: var(--color-ink-muted);
}
.library-plus {
  font-size: 42px;
  font-weight: 300;
}
.library-book {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  background: white;
  box-shadow: 0 3px 10px #17384b05;
}
.library-cover {
  width: 100%;
  min-height: 230px;
  border: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 25px 25px 22px 30px;
  background: #dce8ee;
  color: #244c64;
  box-shadow: inset 7px 0 #244c640b;
  transition: background 0.15s;
}
.library-cover:hover {
  background: #d1e2eb;
}
.cover-1 {
  background: #e3e9e3;
  color: #405b4c;
}
.cover-2 {
  background: #ebe5dc;
  color: #655543;
}
.cover-subject {
  font-size: 10px;
  letter-spacing: 2px;
  opacity: 0.7;
}
.library-cover strong {
  font-size: 21px;
  line-height: 1.6;
  margin: 25px 0 18px;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cover-rule {
  width: 28px;
  border-top: 1px solid currentColor;
  opacity: 0.4;
  margin-bottom: 25px;
}
.cover-bottom {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: auto;
  font-size: 12px;
}
.library-book-info {
  padding: 18px 20px;
}
.library-book-info h2 {
  font-size: 14px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.library-book-info p {
  color: var(--color-ink-muted);
  font-size: 12px;
  margin: 8px 0 15px;
}
.book-actions {
  display: flex;
  gap: 16px;
}
.book-actions button,
.book-actions a {
  border: 0;
  padding: 0;
  background: transparent;
  font-size: 12px;
  color: var(--color-blue-800);
}
.library-empty {
  font-size: 14px;
  color: var(--color-ink-muted);
  margin: 28px 0;
}
.library-note {
  font-size: 12px;
  margin-top: 32px;
}
@media (max-width: 680px) {
  .paper-library {
    padding: 24px 18px 90px;
  }
  .library-heading {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 24px;
  }
  .library-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .library-cover {
    min-height: 200px;
    padding: 20px 15px 18px 20px;
  }
  .library-cover strong {
    font-size: 17px;
  }
  .library-new {
    min-height: 300px;
    padding: 10px;
  }
  .library-new > span:last-child {
    max-width: 100px;
    line-height: 1.8;
  }
  .library-book-info {
    padding: 14px 12px;
  }
  .library-local {
    display: none;
  }
  .library-toolbar input {
    max-width: 55%;
  }
}
</style>
