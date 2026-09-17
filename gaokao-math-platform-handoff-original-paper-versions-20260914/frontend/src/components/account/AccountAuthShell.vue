<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  description: {
    type: String,
    required: true,
  },
  eyebrow: {
    type: String,
    required: true,
  },
  headingId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <main class="account-auth-page">
    <div class="account-auth-shell">
      <section class="account-auth-intro" aria-labelledby="account-auth-brand-title">
        <RouterLink class="account-auth-brand" :to="{ name: 'home' }" aria-label="返回数海首页">
          <span class="account-auth-brand-mark" aria-hidden="true">M</span>
          <span>
            <strong id="account-auth-brand-title">数海</strong>
            <small>MathSea</small>
          </span>
        </RouterLink>

        <div class="account-auth-intro-copy">
          <p>GAOKAO MATHEMATICS</p>
          <h2>把每一次思考，沉淀为看得见的进步。</h2>
          <span>围绕题目、题单与学习记录构建的高考数学学习空间。</span>
        </div>

        <RouterLink class="account-auth-home-link" :to="{ name: 'home' }">
          返回学习首页
        </RouterLink>
      </section>

      <section class="account-auth-card" :aria-labelledby="headingId">
        <header class="account-auth-card-header">
          <p>{{ eyebrow }}</p>
          <h1 :id="headingId">{{ title }}</h1>
          <span>{{ description }}</span>
        </header>

        <slot />

        <footer v-if="$slots.footer" class="account-auth-card-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </main>
</template>
