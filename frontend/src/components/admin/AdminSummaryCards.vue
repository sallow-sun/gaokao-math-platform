<script setup>
defineProps({
  error: {
    type: String,
    default: '',
  },
  items: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['retry'])
</script>

<template>
  <section aria-label="管理数据概览">
    <div class="admin-summary" :aria-busy="loading">
      <article v-for="item in items" :key="item.key" class="admin-summary-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>
    <div v-if="error" class="admin-data-message is-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="admin-inline-action" @click="emit('retry')">重新读取概览</button>
    </div>
    <p v-else-if="loading" class="sr-only" role="status">正在读取管理数据概览</p>
  </section>
</template>
