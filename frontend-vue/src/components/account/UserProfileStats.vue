<script setup>
defineProps({
  stats: {
    type: Array,
    required: true,
  },
})
</script>

<template>
  <section class="account-profile-stats" aria-label="学习统计">
    <article v-for="stat in stats" :key="stat.key">
      <strong>{{ stat.value }}</strong>
      <span>{{ stat.label }}</span>
      <small>{{ stat.description }}</small>
    </article>
  </section>
</template>
