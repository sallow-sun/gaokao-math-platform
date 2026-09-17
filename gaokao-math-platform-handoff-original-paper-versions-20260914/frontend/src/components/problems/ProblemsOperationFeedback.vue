<script setup>
defineProps({
  message: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <p
    v-show="message"
    class="bank-operation-feedback"
    :class="{ 'is-visible': message }"
    role="status"
    aria-live="polite"
  >
    {{ message }}
  </p>
</template>
