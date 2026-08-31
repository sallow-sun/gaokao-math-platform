<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AccountAuthShell from '../components/account/AccountAuthShell.vue'
import AccountPasswordField from '../components/account/AccountPasswordField.vue'
import { authService } from '../services/authService.js'

const username = ref('')
const phone = ref('')
const email = ref('')
const confirmPassword = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)
const router = useRouter()

async function submitRegistration() {
  if (submitting.value) return
  errorMessage.value = ''
  if (password.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }
  submitting.value = true
  try {
    await authService.register({
      username: username.value,
      email: email.value,
      phone: phone.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
    })
    await router.push({ name: 'login' })
  } catch (error) {
    errorMessage.value = error?.message || '注册失败，请检查填写内容'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccountAuthShell
    eyebrow="CREATE ACCOUNT"
    heading-id="register-page-title"
    title="创建账号"
    description="创建账户后，可在不同学习页面中使用统一的个人入口。"
  >
    <form class="account-auth-form" @submit.prevent="submitRegistration">
      <div class="account-form-grid">
        <div class="account-form-group">
          <label for="register-username">用户名</label>
          <input
            id="register-username"
            v-model.trim="username"
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
            v-model.trim="phone"
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
          v-model.trim="email"
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

      <p v-if="errorMessage" id="register-static-status" class="account-static-status" role="alert">
        {{ errorMessage }}
      </p>

      <button
        class="account-primary-button"
        type="submit"
        :disabled="!username || !email || password.length < 8 || !confirmPassword || submitting"
        aria-describedby="register-static-status"
      >
        {{ submitting ? '正在创建……' : '创建账号' }}
      </button>
    </form>

    <template #footer>
      <p class="account-auth-single-link">
        已有账号？<RouterLink :to="{ name: 'login' }">返回登录</RouterLink>
      </p>
    </template>
  </AccountAuthShell>
</template>
