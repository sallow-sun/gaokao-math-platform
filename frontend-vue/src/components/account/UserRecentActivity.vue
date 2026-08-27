<script setup>
defineProps({
  records: {
    type: Array,
    required: true,
  },
})
</script>

<template>
  <section class="account-profile-panel account-profile-activity" aria-labelledby="activity-title">
    <header class="account-profile-panel-header">
      <div>
        <h2 id="activity-title">最近记录</h2>
        <p>最近完成或浏览的题目</p>
      </div>
    </header>

    <div v-if="records.length" class="account-profile-activity-list">
      <article v-for="record in records" :key="record.id">
        <span aria-hidden="true">{{ record.completed ? '✓' : '○' }}</span>
        <div>
          <h3>{{ record.title }}</h3>
          <p>{{ record.summary }}</p>
        </div>
      </article>
    </div>

    <div v-else class="account-profile-empty-state">
      <span aria-hidden="true">∑</span>
      <h3>暂无可展示的学习记录</h3>
      <p>最近记录接口尚未确定，本页面不会使用虚构题目填充。</p>
    </div>
  </section>
</template>
