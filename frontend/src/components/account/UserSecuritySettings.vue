<script setup>
import { USER_PROFILE_PROTOTYPE } from '../../config/account.js'

const SECURITY_GROUPS = Object.freeze([
  {
    key: 'account-information',
    title: '账号信息',
    description: '查看公开身份以及尚待确认的账号联系信息。',
    items: Object.freeze([
      {
        key: 'username',
        label: '用户名',
        description: '显示在个人主页以及未来的用户内容旁。',
        value: USER_PROFILE_PROTOTYPE.username,
        detail: '当前使用静态预览数据，尚未读取账号资料。',
        status: '静态预览',
        tone: 'preview',
      },
      {
        key: 'email',
        label: '邮箱',
        description: '账号邮箱的用途和验证方式尚未确定。',
        value: '未读取真实邮箱',
        detail: '本页不读取真实邮箱；字段和验证流程等待后端契约。',
        status: '待接入',
        tone: 'pending',
      },
      {
        key: 'phone',
        label: '手机号码',
        description: '是否提供手机号以及验证方式尚未确定。',
        value: '未读取真实号码',
        detail: '本页面不会读取、缓存或展示真实手机号。',
        status: '待接入',
        tone: 'pending',
      },
    ]),
  },
  {
    key: 'login-security',
    title: '登录安全',
    description: '管理密码等需要重新验证身份的敏感操作。',
    items: Object.freeze([
      {
        key: 'password',
        label: '登录密码',
        description: '修改密码前应验证当前密码或重新认证身份。',
        value: '修改流程暂不可用',
        detail: '密码规则、验证方式和接口地址均尚未确定。',
        status: '待接入',
        tone: 'pending',
      },
    ]),
  },
])
</script>

<template>
  <div class="account-security-list">
    <section
      v-for="group in SECURITY_GROUPS"
      :key="group.key"
      class="account-settings-card account-security-status-card"
      :aria-labelledby="`security-group-${group.key}`"
    >
      <header class="account-settings-card-header">
        <div>
          <h2 :id="`security-group-${group.key}`">{{ group.title }}</h2>
        </div>
        <span>{{ group.description }}</span>
      </header>

      <ul class="account-security-items">
        <li v-for="item in group.items" :key="item.key" class="account-security-item">
          <div class="account-security-item-copy">
            <strong>{{ item.label }}</strong>
            <p>{{ item.description }}</p>
          </div>

          <div class="account-security-item-value">
            <strong>{{ item.value }}</strong>
            <small>{{ item.detail }}</small>
          </div>

          <span class="account-security-status" :class="`is-${item.tone}`">
            {{ item.status }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
