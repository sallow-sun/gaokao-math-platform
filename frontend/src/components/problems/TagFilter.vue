<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tagCatalog, refreshTagCatalog } from '../../services/tagCatalog.js'
const route = useRoute(),
  router = useRouter()
const tree = tagCatalog,
  expanded = ref(false),
  error = ref(''),
  search = ref(''),
  pinned = ref(null)
const root = ref(null),
  trigger = ref(null),
  searchInput = ref(null)
const storageKey = 'mathsea:tag-pins:v1'
const flatten = (nodes) => nodes.flatMap((n) => [n.name, ...flatten(n.children || [])])
const selected = computed(() => {
  const raw = Array.isArray(route.query.tag)
    ? route.query.tag
    : route.query.tag
      ? [route.query.tag]
      : []
  const aliases = new Map(
    tree.value.flatMap((n) => [n.name, ...(n.aliases || [])].map((a) => [a, n.name])),
  )
  return [...new Set(raw.map((n) => aliases.get(n) || n))]
})
const pins = computed(() =>
  (
    pinned.value || ['集合与逻辑', '函数与导数', '解析几何', '立体几何', '三角与解三角形', '数列']
  ).filter((n) => flatten(tree.value).includes(n)),
)
const groups = computed(() =>
  tree.value
    .map((n) => ({
      name: n.name,
      names: flatten([n]).filter(
        (name) =>
          name.includes(search.value.trim()) ||
          (n.aliases || []).some((a) => a.includes(search.value.trim())),
      ),
    }))
    .filter((n) => n.names.length),
)
function close() {
  expanded.value = false
  trigger.value?.focus()
}
async function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}
function outside(e) {
  if (expanded.value && !root.value?.contains(e.target)) expanded.value = false
}
onMounted(async () => {
  document.addEventListener('pointerdown', outside)
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (Array.isArray(saved)) pinned.value = saved.filter((v) => typeof v === 'string')
  } catch {
    /* optional preference */
  }
  try {
    await refreshTagCatalog()
    if (pinned.value) {
      const aliases = new Map(
        tree.value.flatMap((n) => [n.name, ...(n.aliases || [])].map((a) => [a, n.name])),
      )
      pinned.value = [...new Set(pinned.value.map((n) => aliases.get(n)).filter(Boolean))]
    }
  } catch {
    error.value = '标签更新暂不可用，当前目录仍可使用'
  }
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
function pin(name, checked) {
  pinned.value =
    name === null
      ? null
      : checked
        ? [...new Set([...pins.value, name])]
        : pins.value.filter((n) => n !== name)
  try {
    if (pinned.value === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, JSON.stringify(pinned.value))
  } catch {
    /* optional preference */
  }
}
function select(name) {
  const tags = name
    ? selected.value.includes(name)
      ? selected.value.filter((t) => t !== name)
      : [...selected.value, name]
    : []
  const query = { ...route.query, tag: tags.length ? tags : undefined }
  delete query.page
  router.push({ name: 'problems', query })
}
</script>
<template>
  <div
    ref="root"
    class="bank-filter-group"
    role="group"
    aria-labelledby="tag-filter-label"
    @keydown.esc.stop.prevent="close"
  >
    <span id="tag-filter-label" class="bank-filter-group-label">TAG</span>
    <div class="bank-filter-control">
      <div class="bank-filter-options">
        <button type="button" :aria-pressed="!selected.length" @click="select('')">全部</button>
        <button
          v-for="name in pins"
          :key="name"
          type="button"
          :aria-pressed="selected.includes(name)"
          @click="select(name)"
        >
          {{ name }}
        </button>
        <button
          v-for="name in selected.filter((n) => !pins.includes(n))"
          :key="name"
          type="button"
          aria-pressed="true"
          @click="select(name)"
        >
          {{ name }} ×
        </button>
        <button
          ref="trigger"
          type="button"
          class="bank-filter-more"
          :aria-expanded="expanded"
          aria-controls="tag-filter-detail"
          @click="toggle"
        >
          更多
        </button>
      </div>
      <div
        v-if="expanded"
        id="tag-filter-detail"
        class="bank-filter-popover tag-filter-popover"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tag-dialog-title"
      >
        <header class="bank-filter-popover-header">
          <div>
            <h3 id="tag-dialog-title">所有 TAG</h3>
            <p>可多选；勾选“显示在筛选栏”可设为常用项。</p>
          </div>
          <button
            type="button"
            class="bank-filter-popover-close"
            aria-label="关闭 TAG 窗口"
            @click="close"
          >
            ×
          </button>
        </header>
        <input
          ref="searchInput"
          v-model="search"
          class="tag-search"
          aria-label="搜索标签"
          placeholder="搜索标签"
        />
        <div class="tag-catalog-scroll">
          <section v-for="group in groups" :key="group.name">
            <h4 v-if="group.names.length > 1">{{ group.name }}</h4>
            <div class="bank-filter-catalog-list">
              <div v-for="name in group.names" :key="name" class="bank-filter-catalog-item">
                <button
                  type="button"
                  class="bank-filter-catalog-choice"
                  :aria-pressed="selected.includes(name)"
                  @click="select(name)"
                >
                  {{ name }}
                </button>
                <label class="bank-filter-pin-control"
                  ><input
                    type="checkbox"
                    :checked="pins.includes(name)"
                    :aria-label="`固定 ${name}`"
                    @change="pin(name, $event.target.checked)"
                  /><span>显示在筛选栏</span></label
                >
              </div>
            </div>
          </section>
          <p v-if="!groups.length">没有匹配的标签</p>
        </div>
        <footer class="bank-filter-popover-footer">
          <button type="button" @click="pin(null)">恢复默认常用项</button
          ><button type="button" @click="close">完成</button>
        </footer>
      </div>
      <span v-if="error" role="alert">{{ error }}</span>
    </div>
  </div>
</template>
<style scoped>
.tag-filter-popover {
  width: min(620px, 85vw);
}
.tag-search {
  box-sizing: border-box;
  width: calc(100% - 32px);
  margin: 12px 16px 0;
  padding: 9px 12px;
  border: 1px solid #cbd9e5;
  border-radius: 4px;
  font: inherit;
}
.tag-catalog-scroll {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: min(380px, 48dvh);
  overflow-y: auto;
  padding: 12px 16px;
}
.tag-catalog-scroll h4 {
  font-size: 13px;
  margin: 16px 0 8px;
  color: #43627c;
}
.tag-catalog-scroll .bank-filter-catalog-list {
  grid-template-columns: minmax(0, 1fr);
  max-height: none;
  overflow: visible;
  padding: 0;
}
.tag-catalog-scroll .bank-filter-catalog-choice,
.tag-catalog-scroll .bank-filter-pin-control {
  white-space: nowrap;
}
@media (max-width: 700px) {
  .tag-filter-popover {
    width: auto;
  }
  .tag-catalog-scroll {
    grid-template-columns: 1fr;
    max-height: 43dvh;
  }
}
</style>
