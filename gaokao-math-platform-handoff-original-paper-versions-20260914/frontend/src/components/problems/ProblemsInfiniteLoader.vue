<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  hasMore: {
    type: Boolean,
    required: true,
  },
  isLoading: {
    type: Boolean,
    required: true,
  },
  loadedCount: {
    type: Number,
    required: true,
  },
  pageSize: {
    type: Number,
    required: true,
  },
  totalCount: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['load-more'])
const sentinel = ref(null)
let observer = null

function requestMore() {
  if (props.hasMore && !props.isLoading) {
    emit('load-more')
  }
}

async function observeSentinel() {
  if (!observer) {
    return
  }

  observer.disconnect()
  await nextTick()

  if (sentinel.value && props.hasMore) {
    observer.observe(sentinel.value)
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        requestMore()
      }
    },
    { rootMargin: '240px 0px' },
  )
  observeSentinel()
})

watch(
  () => [props.hasMore, props.loadedCount],
  () => observeSentinel(),
  { flush: 'post' },
)

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <footer v-if="totalCount > 0" ref="sentinel" class="bank-infinite-loader" :aria-busy="isLoading">
    <p class="bank-infinite-loader-status" role="status" aria-live="polite">
      <template v-if="isLoading">正在加载下一批题目……</template>
      <template v-else-if="hasMore">
        已显示 {{ loadedCount }} / {{ totalCount }} 道，每次加载 {{ pageSize }} 道
      </template>
      <template v-else>已加载全部 {{ totalCount }} 道题目</template>
    </p>

    <button v-if="hasMore" type="button" :disabled="isLoading" @click="requestMore">
      {{ isLoading ? '加载中……' : `再加载 ${Math.min(pageSize, totalCount - loadedCount)} 道` }}
    </button>
  </footer>
</template>
