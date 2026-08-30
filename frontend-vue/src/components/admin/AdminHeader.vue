<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="admin-header">
    <RouterLink class="admin-header-back" :to="{ name: 'problems' }">← 返回题库</RouterLink>
    <strong>管理后台</strong>
    <RouterLink
      class="admin-header-account"
      :to="{ name: 'user-profile', params: { userId: 'preview' } }"
      aria-label="查看演示管理员资料"
    >
      <span aria-hidden="true">管</span>
    </RouterLink>
  </header>
</template>
