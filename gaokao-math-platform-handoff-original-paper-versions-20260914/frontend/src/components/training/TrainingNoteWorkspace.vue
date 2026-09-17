<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  draft: {
    type: String,
    default: '',
  },
  entry: {
    type: Object,
    required: true,
  },
  hasNext: {
    type: Boolean,
    default: false,
  },
  hasPrevious: {
    type: Boolean,
    default: false,
  },
  saveStatus: {
    type: String,
    default: 'saved',
    validator: (value) => ['memory', 'saved', 'saving'].includes(value),
  },
})

const emit = defineEmits(['close', 'next', 'previous', 'save-now', 'update:draft'])
const textarea = ref(null)
const saveStatusLabel = computed(() => {
  if (props.saveStatus === 'saving') {
    return '正在自动保存…'
  }

  if (props.saveStatus === 'memory') {
    return '暂存在当前页面，刷新后可能丢失'
  }

  return '已自动保存'
})
const noteTitle = computed(() => props.entry.problem?.title ?? '题目数据暂不可用')
let previouslyFocusedElement = null

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
}

watch(
  () => props.entry.item.problemId,
  async () => {
    await nextTick()
    textarea.value?.focus()
  },
)

onMounted(async () => {
  previouslyFocusedElement = document.activeElement
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  textarea.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  previouslyFocusedElement?.focus?.()
})
</script>

<template>
  <div class="training-note-workspace-host">
    <section
      id="training-note-workspace"
      class="training-note-workspace"
      role="region"
      aria-labelledby="training-note-workspace-title"
      aria-describedby="training-note-workspace-description"
    >
      <header>
        <div>
          <p>题目备注</p>
          <h2 id="training-note-workspace-title">{{ entry.item.problemId }}</h2>
        </div>
        <button type="button" aria-label="关闭备注编辑器" @click="emit('close')">×</button>
      </header>

      <p id="training-note-workspace-description" class="training-note-workspace-problem-title">
        {{ noteTitle }}
      </p>

      <label for="training-note-workspace-input">我的备注</label>
      <textarea
        id="training-note-workspace-input"
        ref="textarea"
        :value="draft"
        rows="8"
        placeholder="记录易错点、关键步骤或下次复习提醒"
        @blur="emit('save-now')"
        @input="emit('update:draft', $event.target.value)"
      ></textarea>

      <div class="training-note-workspace-status" :class="`is-${saveStatus}`" aria-live="polite">
        <span aria-hidden="true"></span>
        <p>{{ saveStatusLabel }}</p>
      </div>
      <p class="training-note-workspace-storage">备注保存在当前浏览器，不会参与快速分享。</p>

      <nav aria-label="切换备注题目">
        <button type="button" :disabled="!hasPrevious" @click="emit('previous')">← 上一题</button>
        <button type="button" :disabled="!hasNext" @click="emit('next')">下一题 →</button>
        <RouterLink
          v-if="entry.problem"
          :to="{ name: 'question', params: { problemNumber: entry.item.problemId } }"
        >
          进入题目详情
        </RouterLink>
      </nav>
    </section>
  </div>
</template>
