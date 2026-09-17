<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AccountAuthShell from '../components/account/AccountAuthShell.vue'
import AccountPasswordField from '../components/account/AccountPasswordField.vue'
import { authService } from '../services/authService.js'
import { usePracticeListsStore } from '../stores/practiceLists.js'

const account = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)
const route = useRoute()
const router = useRouter()
const practiceListsStore = usePracticeListsStore()

async function submitLogin() {
  if (!account.value || !password.value || submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    const auth = await authService.login(account.value, password.value)
    await practiceListsStore.establishSession(auth)
    const redirect = Array.isArray(route.query.redirect)
      ? route.query.redirect[0]
      : route.query.redirect
    await router.push(
      typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : { name: 'training', query: { tab: 'mine' } },
    )
  } catch (error) {
    errorMessage.value = error?.message || '登录失败，请检查账号和密码'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccountAuthShell
    eyebrow="WELCOME BACK"
    heading-id="login-page-title"
    title="登录账号"
    description="登录后可继续管理你的学习空间。"
  >
    <form class="account-auth-form" @submit.prevent="submitLogin">
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

      <p v-if="errorMessage" id="login-static-status" class="account-static-status" role="alert">
        {{ errorMessage }}
      </p>

      <button
        class="account-primary-button"
        type="submit"
        :disabled="!account || !password || submitting"
        aria-describedby="login-static-status"
      >
        {{ submitting ? '正在登录……' : '登录' }}
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
