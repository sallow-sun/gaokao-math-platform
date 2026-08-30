<script setup>
defineProps({
  stats: {
    type: Array,
    required: true,
  },
})
</script>

<template>
  <section class="account-profile-summary" aria-labelledby="account-profile-summary-title">
    <header class="account-profile-section-heading">
      <div>
        <h2 id="account-profile-summary-title">学习概览</h2>
        <p>了解公开的做题进度与学习节奏</p>
      </div>
      <span>等待公开学习统计接口</span>
    </header>

    <dl class="account-profile-stats">
      <div v-for="stat in stats" :key="stat.key">
        <dt>{{ stat.label }}</dt>
        <dd>{{ stat.value }}</dd>
        <small>{{ stat.description }}</small>
      </div>
    </dl>
  </section>
</template>
