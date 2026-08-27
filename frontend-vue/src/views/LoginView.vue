<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import AccountAuthShell from '../components/account/AccountAuthShell.vue'
import AccountPasswordField from '../components/account/AccountPasswordField.vue'

const account = ref('')
const password = ref('')
</script>

<template>
  <AccountAuthShell
    eyebrow="WELCOME BACK"
    heading-id="login-page-title"
    title="登录账号"
    description="登录后可继续管理你的学习空间。"
  >
    <form class="account-auth-form" novalidate @submit.prevent>
      <div class="account-form-group">
        <label for="login-account">登录账号</label>
        <input
          id="login-account"
          v-model.trim="account"
          name="account"
          type="text"
          autocomplete="username"
          placeholder="用户名、UID、邮箱或手机号"
        />
      </div>

      <AccountPasswordField
        v-model="password"
        field-id="login-password"
        name="password"
        label="登录密码"
        placeholder="请输入登录密码"
      />

      <p id="login-static-status" class="account-static-status" role="status">
        当前为静态页面，登录功能将在账户接口确定后接入。
      </p>

      <button
        class="account-primary-button"
        type="submit"
        disabled
        aria-describedby="login-static-status"
      >
        登录（待接入）
      </button>
    </form>

    <template #footer>
      <nav class="account-auth-links" aria-label="账号帮助">
        <RouterLink :to="{ name: 'register' }">创建账号</RouterLink>
        <RouterLink :to="{ name: 'forgot-password' }">忘记密码？</RouterLink>
      </nav>
    </template>
  </AccountAuthShell>
</template>
