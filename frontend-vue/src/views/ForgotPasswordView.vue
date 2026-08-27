<script setup>
import { RouterLink } from 'vue-router'
import AccountAuthShell from '../components/account/AccountAuthShell.vue'
</script>

<template>
  <AccountAuthShell
    eyebrow="ACCOUNT RECOVERY"
    heading-id="forgot-password-page-title"
    title="找回密码"
    description="正式功能将通过经过验证的邮箱流程帮助你重设密码。"
  >
    <form class="account-auth-form" novalidate @submit.prevent>
      <div class="account-form-group">
        <label for="forgot-account">账号</label>
        <input
          id="forgot-account"
          name="account"
          type="text"
          autocomplete="username"
          placeholder="用户名、UID、邮箱或手机号"
        />
      </div>

      <div class="account-form-group">
        <label for="forgot-email">注册邮箱</label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="name@example.com"
        />
      </div>

      <aside class="account-security-note" aria-labelledby="password-recovery-note-title">
        <strong id="password-recovery-note-title">安全说明</strong>
        <p>页面不会直接修改密码。验证方式和重置流程将在后端协议确定后接入。</p>
      </aside>

      <p id="forgot-static-status" class="account-static-status" role="status">
        当前为静态页面，不会发送验证邮件。
      </p>

      <button
        class="account-primary-button"
        type="submit"
        disabled
        aria-describedby="forgot-static-status"
      >
        发送验证邮件（待接入）
      </button>
    </form>

    <template #footer>
      <p class="account-auth-single-link">
        想起密码了？<RouterLink :to="{ name: 'login' }">返回登录</RouterLink>
      </p>
    </template>
  </AccountAuthShell>
</template>
