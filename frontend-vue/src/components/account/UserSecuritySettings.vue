<template>
  <div class="account-security-list">
    <form class="account-settings-card account-security-card" @submit.prevent>
      <div class="account-setting-copy">
        <h2>修改用户名</h2>
        <p>用户名会显示在个人主页以及未来的用户内容旁。</p>
      </div>
      <div class="account-security-form">
        <label for="security-username">新用户名</label>
        <input id="security-username" name="username" type="text" disabled placeholder="待接入" />
        <button type="submit" disabled>修改用户名（待接入）</button>
      </div>
    </form>

    <form class="account-settings-card account-security-card" @submit.prevent>
      <div class="account-setting-copy">
        <h2>修改密码</h2>
        <p>正式功能需要验证当前密码，并遵循后端确定的密码规则。</p>
      </div>
      <div class="account-security-form account-security-password-form">
        <label for="security-current-password">当前密码</label>
        <input
          id="security-current-password"
          name="currentPassword"
          type="password"
          autocomplete="current-password"
          disabled
          placeholder="接口接入后可填写"
        />
        <label for="security-new-password">新密码</label>
        <input
          id="security-new-password"
          name="newPassword"
          type="password"
          autocomplete="new-password"
          disabled
          placeholder="接口接入后可填写"
        />
        <label for="security-confirm-password">确认新密码</label>
        <input
          id="security-confirm-password"
          name="confirmPassword"
          type="password"
          autocomplete="new-password"
          disabled
          placeholder="接口接入后可填写"
        />
        <button type="submit" disabled>修改密码（待接入）</button>
      </div>
    </form>

    <form class="account-settings-card account-security-card" @submit.prevent>
      <div class="account-setting-copy">
        <h2>修改邮箱</h2>
        <p>邮箱验证方式尚未确定，本页不会读取或展示真实邮箱。</p>
      </div>
      <div class="account-security-form">
        <label for="security-email">新邮箱</label>
        <input
          id="security-email"
          name="email"
          type="email"
          autocomplete="email"
          disabled
          placeholder="name@example.com"
        />
        <button type="submit" disabled>修改邮箱（待接入）</button>
      </div>
    </form>

    <form class="account-settings-card account-security-card" @submit.prevent>
      <div class="account-setting-copy">
        <h2>修改手机</h2>
        <p>手机号验证方式尚未确定，本页不会读取或展示真实号码。</p>
      </div>
      <div class="account-security-form">
        <label for="security-phone">新手机号</label>
        <input
          id="security-phone"
          name="phone"
          type="tel"
          autocomplete="tel"
          disabled
          placeholder="接口接入后可填写"
        />
        <button type="submit" disabled>修改手机（待接入）</button>
      </div>
    </form>

    <p class="account-security-static-note" role="status">
      所有安全设置均为静态布局。接口和验证规则确定前，不会收集或提交任何账户信息。
    </p>
  </div>
</template>
