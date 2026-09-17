<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  avatarUrl: {
    type: String,
    default: '',
  },
  username: {
    type: String,
    required: true,
  },
})

const imageFailed = ref(false)
const initial = computed(() => props.username.trim().charAt(0).toUpperCase() || 'M')
const showImage = computed(() => Boolean(props.avatarUrl) && !imageFailed.value)

watch(
  () => props.avatarUrl,
  () => {
    imageFailed.value = false
  },
)
</script>

<template>
  <div class="account-avatar" role="img" :aria-label="`${username}的头像`">
    <img v-if="showImage" :src="avatarUrl" alt="" @error="imageFailed = true" />
    <span v-else aria-hidden="true">{{ initial }}</span>
  </div>
</template>
