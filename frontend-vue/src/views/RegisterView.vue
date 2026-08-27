<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import AccountAuthShell from '../components/account/AccountAuthShell.vue'
import AccountPasswordField from '../components/account/AccountPasswordField.vue'

const confirmPassword = ref('')
const password = ref('')
</script>

<template>
  <AccountAuthShell
    eyebrow="CREATE ACCOUNT"
    heading-id="register-page-title"
    title="创建账号"
    description="创建账户后，可在不同学习页面中使用统一的个人入口。"
  >
    <form class="account-auth-form" novalidate @submit.prevent>
      <div class="account-form-grid">
        <div class="account-form-group">
          <label for="register-username">用户名</label>
          <input
            id="register-username"
            name="username"
            type="text"
            minlength="2"
            maxlength="20"
            autocomplete="username"
            placeholder="2 到 20 个字符"
          />
        </div>

        <div class="account-form-group">
          <label for="register-phone">手机号码 <span>选填</span></label>
          <input
            id="register-phone"
            name="phone"
            type="tel"
            autocomplete="tel"
            placeholder="请输入手机号码"
          />
        </div>
      </div>

      <div class="account-form-group">
        <label for="register-email">电子邮箱</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="name@example.com"
        />
      </div>

      <div class="account-form-grid">
        <AccountPasswordField
          v-model="password"
          field-id="register-password"
          name="password"
          label="密码"
          autocomplete="new-password"
          placeholder="至少 8 个字符"
        />
        <AccountPasswordField
          v-model="confirmPassword"
          field-id="register-confirm-password"
          name="confirmPassword"
          label="确认密码"
          autocomplete="new-password"
          placeholder="再次输入密码"
        />
      </div>

      <div class="account-agreement-placeholder" aria-label="用户协议状态">
        <span aria-hidden="true">○</span>
        用户协议内容尚未确定，注册功能暂不可用。
      </div>

      <p id="register-static-status" class="account-static-status" role="status">
        当前为静态页面，资料不会被提交或保存。
      </p>

      <button
        class="account-primary-button"
        type="submit"
        disabled
        aria-describedby="register-static-status"
      >
        创建账号（待接入）
      </button>
    </form>

    <template #footer>
      <p class="account-auth-single-link">
        已有账号？<RouterLink :to="{ name: 'login' }">返回登录</RouterLink>
      </p>
    </template>
  </AccountAuthShell>
</template>
