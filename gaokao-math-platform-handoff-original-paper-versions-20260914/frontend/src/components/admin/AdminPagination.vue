<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  pagination: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['page-change'])

const pageCount = computed(() =>
  Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize)),
)

function changePage(page) {
  if (page >= 1 && page <= pageCount.value && page !== props.pagination.page) {
    emit('page-change', page)
  }
}
</script>

<template>
  <nav class="admin-pagination" :aria-label="`${label}分页`">
    <p>共 {{ pagination.total }} 条 · 第 {{ pagination.page }} / {{ pageCount }} 页</p>
    <div>
      <button
        type="button"
        class="admin-inline-action"
        :disabled="pagination.page <= 1"
        @click="changePage(pagination.page - 1)"
      >
        上一页
      </button>
      <button
        type="button"
        class="admin-inline-action"
        :disabled="!pagination.hasNext"
        @click="changePage(pagination.page + 1)"
      >
        下一页
      </button>
    </div>
  </nav>
</template>
