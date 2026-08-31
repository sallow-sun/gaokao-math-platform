<script setup>
import { ref } from 'vue'

const isExpanded = ref(false)
</script>

<template>
  <section class="question-forum-placeholder" aria-labelledby="question-forum-title">
    <header class="question-forum-placeholder-header">
      <div>
        <h2 id="question-forum-title">演算草稿</h2>
        <p>预留给后续论坛发帖页面</p>
      </div>
    </header>

    <div
      id="question-forum-placeholder-content"
      class="question-sidebar-content question-forum-placeholder-content"
      role="region"
      aria-labelledby="question-forum-title"
      :hidden="!isExpanded"
    >
      <p>后续将在此接入论坛发帖页面。</p>
    </div>

    <button
      type="button"
      class="question-sidebar-toggle"
      :aria-expanded="isExpanded"
      aria-controls="question-forum-placeholder-content"
      @click="isExpanded = !isExpanded"
    >
      <span class="question-sidebar-arrow" aria-hidden="true"></span>
      <span>{{ isExpanded ? '收起草稿区' : '展开草稿区' }}</span>
    </button>
  </section>
</template>
