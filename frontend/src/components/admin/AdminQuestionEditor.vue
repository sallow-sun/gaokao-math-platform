<script setup>
import { ref } from 'vue'
defineProps({
  editing: {
    type: Boolean,
    default: false,
  },
  feedback: {
    type: String,
    default: '',
  },
  levelOptions: {
    type: Array,
    required: true,
  },
  modelValue: {
    type: Object,
    required: true,
  },
  pending: {
    type: Boolean,
    default: false,
  },
  sourceOptions: {
    type: Array,
    required: true,
  },
  tagOptions: {
    type: Array,
    required: true,
  },
  typeOptions: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['cancel', 'field-change', 'import-files', 'submit', 'tag-change'])
const fileInput = ref(null)
const draggingFiles = ref(false)

function selectFiles(files) {
  const supportedExtensions = ['.md', '.png', '.jpg', '.jpeg', '.gif', '.webp']
  const importFiles = Array.from(files ?? []).filter((file) =>
    supportedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)),
  )
  if (importFiles.length) emit('import-files', importFiles)
  draggingFiles.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function updateField(field, value) {
  emit('field-change', { field, value })
}

function updateTag(tag, checked) {
  emit('tag-change', { checked, tag })
}
</script>

<template>
  <form class="admin-question-editor" @submit.prevent="emit('submit')">
    <header class="admin-panel-header">
      <div>
        <h2>{{ editing ? `编辑 ${modelValue.id}` : '新增题目' }}</h2>
        <p>保存后会立即写入题库数据库，题号、题型、训练价值和题面必填。</p>
      </div>
      <button v-if="editing" type="button" class="admin-inline-action" @click="emit('cancel')">
        取消编辑
      </button>
    </header>

    <div class="admin-form-body">
      <section
        class="admin-markdown-dropzone"
        :class="{ 'is-dragging': draggingFiles }"
        @click="fileInput?.click()"
        @dragenter.prevent="draggingFiles = true"
        @dragover.prevent="draggingFiles = true"
        @dragleave.prevent="draggingFiles = false"
        @drop.prevent="selectFiles($event.dataTransfer.files)"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".md,.png,.jpg,.jpeg,.gif,.webp,text/markdown,image/png,image/jpeg,image/gif,image/webp"
          multiple
          @change="selectFiles($event.target.files)"
        />
        <strong>一键添加 Markdown 题目和配图</strong>
        <span>可同时选择多个文件；图片主文件名须与题目编号一致，例如 P10003.md + P10003.png</span>
      </section>

      <div class="admin-form-grid">
        <label>
          <span>题目编号</span>
          <input
            name="id"
            required
            maxlength="32"
            pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
            autocomplete="off"
            placeholder="例如：P10003A 或 MOCK-01"
            title="只能包含英文字母、数字、下划线和连字符"
            :disabled="editing"
            :value="modelValue.id"
            @input="updateField('id', $event.target.value.toUpperCase())"
          />
        </label>

        <label>
          <span>年份</span>
          <input
            name="year"
            inputmode="numeric"
            maxlength="4"
            placeholder="2026"
            :value="modelValue.year"
            @input="updateField('year', $event.target.value)"
          />
        </label>

        <label class="admin-form-full">
          <span>标题</span>
          <input
            name="title"
            autocomplete="off"
            placeholder="例如：2025 年新高考Ⅰ卷 · T1"
            :value="modelValue.title"
            @input="updateField('title', $event.target.value)"
          />
        </label>

        <label class="admin-form-full">
          <span>地区</span>
          <input
            name="region"
            autocomplete="off"
            placeholder="例如：全国、北京"
            :value="modelValue.region"
            @input="updateField('region', $event.target.value)"
          />
        </label>

        <label>
          <span>来源</span>
          <select
            name="source"
            :value="modelValue.source"
            @change="updateField('source', $event.target.value)"
          >
            <option value="">请选择</option>
            <option v-for="option in sourceOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label>
          <span>题型</span>
          <select
            name="type"
            :value="modelValue.type"
            @change="updateField('type', $event.target.value)"
          >
            <option value="">请选择</option>
            <option v-for="option in typeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="admin-form-full">
          <span>训练价值</span>
          <select
            name="level"
            :value="modelValue.level"
            @change="updateField('level', $event.target.value)"
          >
            <option value="">请选择</option>
            <option v-for="option in levelOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <fieldset class="admin-tag-field admin-form-full">
          <legend>知识标签</legend>
          <div class="admin-tag-options">
            <label v-for="tag in tagOptions" :key="tag" class="admin-tag-option">
              <input
                type="checkbox"
                name="tags"
                :value="tag"
                :checked="modelValue.tags.includes(tag)"
                @change="updateTag(tag, $event.target.checked)"
              />
              <span>{{ tag }}</span>
            </label>
            <p v-if="tagOptions.length === 0">当前题库还没有可选标签。</p>
          </div>
        </fieldset>

        <label class="admin-form-full">
          <span>题面</span>
          <textarea
            name="content"
            rows="8"
            required
            :value="modelValue.content"
            aria-describedby="material-font-help"
            @input="updateField('content', $event.target.value)"
          ></textarea>
          <small id="material-font-help">中文正文使用宋体，英文和数字使用 Times New Roman。材料段落前单独写一行 :::material，结束后单独写一行 :::，材料中文将使用楷体。</small>
        </label>

        <label class="admin-form-full">
          <span>最终答案</span>
          <textarea
            name="answer"
            rows="3"
            :value="modelValue.answer"
            @input="updateField('answer', $event.target.value)"
          ></textarea>
        </label>

        <label class="admin-form-full">
          <span>题解</span>
          <textarea
            name="solution"
            rows="6"
            :value="modelValue.solution"
            @input="updateField('solution', $event.target.value)"
          ></textarea>
        </label>
      </div>

      <div class="admin-form-actions">
        <p class="admin-form-feedback" role="status" aria-live="polite">{{ feedback }}</p>
        <button type="submit" class="admin-primary-action" :disabled="pending">
          {{ pending ? '正在处理……' : editing ? '保存修改' : '新增题目' }}
        </button>
      </div>
    </div>
  </form>
</template>
