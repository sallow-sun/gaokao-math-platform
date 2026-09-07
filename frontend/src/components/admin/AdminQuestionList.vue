<script setup>
import AdminPagination from './AdminPagination.vue'

defineProps({
  error: {
    type: String,
    default: '',
  },
  keyword: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  pendingProblemId: {
    type: String,
    default: '',
  },
  pagination: {
    type: Object,
    required: true,
  },
  problems: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['delete-request', 'edit', 'keyword-change', 'page-change', 'retry'])
</script>

<template>
  <section class="admin-question-list-panel" aria-labelledby="admin-question-list-title">
    <header class="admin-panel-header">
      <div>
        <h2 id="admin-question-list-title">已有题目</h2>
        <p>点击编辑，将题目载入左侧表单。</p>
      </div>
      <label class="admin-search-field">
        <span class="sr-only">搜索题目</span>
        <input
          type="search"
          :value="keyword"
          placeholder="搜索题号、标题或标签"
          @input="emit('keyword-change', $event.target.value)"
        />
      </label>
    </header>

    <div class="admin-question-list" :aria-busy="loading">
      <p v-if="loading" class="admin-empty-state" role="status">正在读取题目……</p>
      <div v-else-if="error" class="admin-empty-state is-error" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="admin-inline-action" @click="emit('retry')">
          重新读取题目
        </button>
      </div>

      <article
        v-for="problem in loading || error ? [] : problems"
        :key="problem.id"
        class="admin-question-item"
      >
        <div class="admin-question-item-heading">
          <div>
            <h3>{{ problem.id }}</h3>
            <p>
              {{ problem.year || '年份未设置' }} · {{ problem.sourceLabel || '来源未设置' }} ·
              {{ problem.typeLabel || '题型未设置' }}
            </p>
          </div>
          <div class="admin-row-actions">
            <button
              type="button"
              class="admin-inline-action"
              :disabled="pendingProblemId === problem.id"
              @click="emit('edit', problem)"
            >
              编辑
            </button>
            <button
              type="button"
              class="admin-inline-action is-danger"
              :disabled="pendingProblemId === problem.id"
              @click="emit('delete-request', problem)"
            >
              删除
            </button>
          </div>
        </div>
        <strong>{{ problem.title || '标题未设置' }}</strong>
        <p class="admin-question-preview">{{ problem.content }}</p>
        <ul v-if="problem.tags.length" class="admin-question-tags" aria-label="题目标签">
          <li v-for="tag in problem.tags" :key="tag">{{ tag }}</li>
        </ul>
      </article>

      <p v-if="!loading && !error && problems.length === 0" class="admin-empty-state">
        没有符合条件的题目
      </p>
    </div>
    <AdminPagination
      v-if="!loading && !error"
      label="题目列表"
      :pagination="pagination"
      @page-change="emit('page-change', $event)"
    />
  </section>
</template>
