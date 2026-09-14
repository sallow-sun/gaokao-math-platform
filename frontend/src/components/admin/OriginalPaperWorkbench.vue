<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
import MathText from '../content/MathText.vue'
const props = defineProps({ canPublish: Boolean })
const papers = ref([]),
  current = ref(null),
  assembly = ref(null),
  selected = ref(''),
  query = ref(''),
  busy = ref(false),
  error = ref(''),
  message = ref(''),
  note = ref(''),
  confirmed = ref(false)
const endpoint = '/api/v1/admin/original-papers'
const prepared = ref(false),
  savedAssembly = ref('')
const dirty = computed(() => JSON.stringify(assembly.value) !== savedAssembly.value)
const visible = computed(() => papers.value.filter((p) => p.title.includes(query.value)))
const rows = computed(() => current.value?.items || [])
const totals = computed(() =>
  rows.value.reduce(
    (sum, row) => {
      const item = assembly.value.items[row.id]
      if (!item.exclude) {
        sum.count++
        sum.score += Number(item.score) || 0
      }
      return sum
    },
    { count: 0, score: 0 },
  ),
)
async function run(work) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    await work()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
function adopt(data) {
  prepared.value = false
  current.value = data
  assembly.value = {
    expectedCount: data.items.length,
    targetScore: 150,
    ...data.assembly,
    items: { ...data.assembly.items },
  }
  data.items.forEach((item, index) => {
    assembly.value.items[item.id] = {
      order: index + 1,
      score:
        item.document.type === 'solution' ? 12 : item.document.type === 'multiple-choice' ? 6 : 5,
      reuse: '',
      exclude: false,
      ...assembly.value.items[item.id],
    }
  })
  confirmed.value = false
  savedAssembly.value = JSON.stringify(assembly.value)
}
function load(id) {
  run(async () => {
    selected.value = id
    adopt(await apiRequest(`${endpoint}/${id}`))
    note.value = ''
  })
}
function save() {
  run(async () => {
    adopt(
      await apiRequest(`${endpoint}/${selected.value}`, {
        method: 'PUT',
        body: { version: current.value.assembly_version, assembly: assembly.value },
      }),
    )
    prepared.value = true
    message.value = '整理草稿已保存；可继续核对并发布。'
  })
}
function reuse(row, candidate) {
  assembly.value.items[row.id].reuse = candidate.problem_number
  confirmed.value = false
}
function publish() {
  run(async () => {
    if (!prepared.value || dirty.value) throw new Error('请先保存整理草稿并核对最终题目。')
    await apiRequest(`${endpoint}/${selected.value}/publish`, {
      method: 'POST',
      body: {
        version: current.value.assembly_version,
        token: current.value.token,
        note: note.value,
      },
    })
    adopt(await apiRequest(`${endpoint}/${selected.value}`))
    papers.value = await apiRequest(endpoint)
    message.value = '已核验并发布到试卷库，内容已锁定。'
    message.value += ` 可在下方“已发布版本”中查看并打印。`
  })
}
onMounted(() =>
  run(async () => {
    papers.value = await apiRequest(endpoint)
  }),
)
</script>

<template>
  <section class="original-workbench">
    <header>
      <h2>原卷整理</h2>
      <p>按上传归属自动汇集题目。核对原卷题序、分值和重复题后发布固定版本。</p>
    </header>
    <p v-if="error" class="original-error" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <div class="original-layout">
      <aside>
        <input v-model="query" placeholder="搜索原卷名称" aria-label="搜索原卷" />
        <button
          v-for="paper in visible"
          :key="paper.id"
          :aria-pressed="selected === paper.id"
          :disabled="busy"
          @click="load(paper.id)"
        >
          <strong>{{ paper.title }}</strong
          ><small
            >{{ paper.question_count }} 题 ·
            {{ paper.revision ? `已发布 v${paper.revision}` : '待整理' }}</small
          >
        </button>
        <p v-if="!papers.length">导入题目并确认试卷归属后，原卷会自动出现在这里。</p>
      </aside>
      <div v-if="current" class="original-editor">
        <h3>{{ current.title }}</h3>
        <p class="original-muted">
          默认分值仅作起点，请对照原卷核验。原卷和自由组卷使用同一打印样式，题型按单选、多选、填空、解答排列。
        </p>
        <fieldset :disabled="busy">
          <div class="original-fields">
            <label
              >预期题数<input
                v-model.number="assembly.expectedCount"
                type="number"
                min="1"
                max="100"
            /></label>
            <label
              >原卷总分<input
                v-model.number="assembly.targetScore"
                type="number"
                min="1"
                max="1000"
            /></label>
            <label
              >年份<input v-model.number="assembly.year" type="number" min="1900" max="2100"
            /></label>
            <label>地区 / 来源<input v-model="assembly.source" maxlength="160" /></label>
            <label>卷别<input v-model="assembly.examMode" maxlength="80" /></label>
          </div>
          <div class="original-summary">
            选中 {{ totals.count }} / {{ assembly.expectedCount }} 题 · {{ totals.score }} /
            {{ assembly.targetScore }} 分
          </div>
          <article
            v-for="row in rows"
            :key="row.id"
            class="original-question"
            :class="{ excluded: assembly.items[row.id].exclude }"
          >
            <header>
              <label class="original-check"
                ><input v-model="assembly.items[row.id].exclude" type="checkbox" />排除此项</label
              >
              <span
                >原题号 {{ row.original_number }} ·
                {{ row.status === 'PUBLISHED' ? '已发布' : '待审核' }}</span
              >
              <label
                >排序<input
                  v-model.number="assembly.items[row.id].order"
                  type="number"
                  min="1"
                  max="100"
              /></label>
              <label
                >分值<input
                  v-model.number="assembly.items[row.id].score"
                  type="number"
                  min="0.5"
                  max="100"
                  step="0.5"
              /></label>
            </header>
            <details>
              <summary>
                {{ row.document.title || '查看题目' }} · {{ row.problem_number || '尚未入库' }}
              </summary>
              <MathText :text="row.document.content" /><img
                v-for="asset in row.document.assets?.filter((a) => a.section === 'content')"
                :key="asset.id"
                :src="asset.url"
                :alt="asset.altText"
              />
            </details>
            <details v-if="row.duplicates?.length" class="original-duplicates">
              <summary>
                发现 {{ row.duplicates.length }} 道疑似重复题，请比较公式、选项与配图
              </summary>
              <p>
                相似检测仅作提示，不会自动覆盖或删除。确认是同一道题后，可直接复用已有题目，不必再次入库。
              </p>
              <div v-for="candidate in row.duplicates" :key="candidate.problem_number">
                <a :href="`/problems/${candidate.problem_number}`" target="_blank" rel="noopener"
                  >{{ candidate.problem_number }} · {{ candidate.title }} ↗</a
                >
                <MathText :text="candidate.content" />
                <button type="button" @click="reuse(row, candidate)">复用此题</button>
              </div>
            </details>
            <label class="original-reuse"
              >复用题号（留空使用该题审核结果）<input
                v-model="assembly.items[row.id].reuse"
                placeholder="例如 GC000055"
                maxlength="32"
            /></label>
            <a
              v-if="assembly.items[row.id].reuse"
              :href="`/problems/${encodeURIComponent(assembly.items[row.id].reuse)}`"
              target="_blank"
              rel="noopener"
              >打开拟复用题目，核对完整内容与配图 ↗</a
            >
            <details v-if="row.problem">
              <summary>查看保存时的最终题目 · {{ row.problem.problem_number }}</summary>
              <MathText :text="row.problem.content" /><img
                v-for="(asset, index) in row.problem.assets"
                :key="index"
                :src="asset.url"
                :alt="asset.altText"
              />
            </details>
          </article>
          <label
            >核验范围 / 版本说明<textarea
              v-model="note"
              maxlength="500"
              placeholder="例如：已对照原卷检查全部题目、图片、题序及分值；v2 修正第 8 题。答案解析未核验。"
            />
          </label>
          <label class="original-check"
            ><input
              v-model="confirmed"
              type="checkbox"
            />我已对照原卷核对题目、题序和分值，确认所选重复题的归属。</label
          >
          <p class="original-muted">
            请先保存整理草稿，再核对“最终题目”并勾选确认。保存后题目如有变化，系统会要求重新核对。
          </p>
          <footer>
            <button type="button" @click="save">保存整理草稿</button
            ><button
              v-if="props.canPublish"
              type="button"
              class="original-primary"
              :disabled="
                !prepared ||
                dirty ||
                !confirmed ||
                !note.trim() ||
                totals.count !== Number(assembly.expectedCount) ||
                totals.score !== Number(assembly.targetScore)
              "
              @click="publish"
            >
              核验并发布 v{{ (current.versions[0]?.revision || 0) + 1 }}
            </button>
          </footer>
        </fieldset>
        <section v-if="current.versions.length" class="original-versions">
          <h3>已发布版本</h3>
          <p>后续修改只进入新版本草稿，已发布内容保持不变。评分与收藏按版本分别记录。</p>
          <div v-for="version in current.versions" :key="version.id">
            <RouterLink v-if="!version.deleted" :to="`/papers/${version.id}`"
              >v{{ version.revision }} · 查看 / 打印</RouterLink
            ><span v-else>v{{ version.revision }} · 已下架</span
            ><small>{{ version.revision_note }}</small>
          </div>
        </section>
      </div>
      <div v-else class="original-empty">选择左侧原卷开始整理。</div>
    </div>
  </section>
</template>

<style scoped>
.original-workbench {
  padding: 20px;
  background: #fff;
  border: 1px solid #d3dfeb;
  border-radius: 6px;
  color: #234c6c;
}
.original-workbench h2,
.original-workbench h3 {
  color: #102f46;
  margin: 0 0 10px;
}
.original-workbench p {
  font-size: 14px;
  line-height: 1.7;
}
.original-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
  margin-top: 20px;
}
.original-layout aside {
  border-right: 1px solid #dce5ed;
  padding-right: 16px;
}
.original-layout aside button {
  display: flex;
  flex-direction: column;
  text-align: left;
  width: 100%;
  gap: 8px;
  margin-top: 8px;
  padding: 12px;
}
.original-layout aside button[aria-pressed='true'] {
  background: #e8f1f8;
  border-color: #245b87;
}
.original-layout small {
  display: block;
  color: #738ca1;
  font-size: 12px;
}
.original-workbench input:not([type='checkbox']),
.original-workbench textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid #ccdbe8;
  border-radius: 4px;
  padding: 8px;
  background: #fff;
  color: inherit;
  font: inherit;
}
.original-workbench input[type='checkbox'] {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin: 0;
  flex: none;
}
.original-workbench button {
  border: 1px solid #ccdbe8;
  border-radius: 4px;
  background: white;
  color: #245b87;
  padding: 8px 12px;
  cursor: pointer;
}
.original-workbench button:disabled {
  opacity: 0.5;
  cursor: default;
}
.original-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.original-workbench label {
  display: block;
  font-size: 13px;
}
.original-workbench label input,
.original-workbench textarea {
  margin-top: 6px;
}
.original-workbench .original-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
}
.original-summary {
  padding: 12px;
  background: #eef4f8;
  margin: 18px 0;
}
.original-question {
  border: 1px solid #dce5ed;
  border-radius: 4px;
  margin-bottom: 12px;
  padding: 14px;
}
.original-question > header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  margin-bottom: 12px;
}
.original-question > header label:not(.original-check) {
  width: 66px;
}
.original-question > header span {
  flex: 1;
}
.original-question details {
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.original-question summary {
  cursor: pointer;
}
.original-question img {
  max-width: 100%;
  max-height: 250px;
  object-fit: contain;
}
.original-duplicates {
  margin: 12px 0;
  padding: 10px;
  background: #fff8e9;
}
.original-duplicates > div {
  padding: 12px 0;
  border-top: 1px solid #eadfc8;
}
.original-reuse {
  margin-top: 12px;
  max-width: 330px;
}
.original-muted {
  color: #738ca1;
}
.original-workbench fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
.original-workbench textarea {
  min-height: 90px;
}
.original-workbench footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin: 18px 0;
}
.original-workbench .original-primary {
  background: #205b87;
  color: white;
}
.original-error {
  color: #a33c32;
}
.original-question.excluded {
  opacity: 0.55;
}
.original-versions {
  border-top: 1px solid #dce5ed;
  padding-top: 18px;
}
.original-versions > div {
  padding: 8px 0;
}
.original-empty {
  padding: 60px;
  text-align: center;
  color: #738ca1;
}
@media (max-width: 900px) {
  .original-layout {
    grid-template-columns: 1fr;
  }
  .original-layout aside {
    border: 0;
    max-height: 240px;
    overflow: auto;
  }
  .original-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .original-workbench {
    padding: 12px;
  }
}
</style>
