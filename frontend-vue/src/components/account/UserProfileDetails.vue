<script setup>
defineProps({
  profile: {
    type: Object,
    required: true,
  },
  routeUserId: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <section class="account-profile-panel" aria-labelledby="account-profile-details-title">
    <header class="account-profile-panel-header">
      <div>
        <h2 id="account-profile-details-title">公开资料</h2>
        <p>这里只展示允许公开的用户信息</p>
      </div>
    </header>

    <dl class="account-profile-details">
      <div>
        <dt>用户名</dt>
        <dd>{{ profile.username }}</dd>
      </div>
      <div>
        <dt>用户 ID</dt>
        <dd>{{ routeUserId }}</dd>
      </div>
      <div>
        <dt>用户 UID</dt>
        <dd>{{ profile.uid }}</dd>
      </div>
      <div>
        <dt>注册时间</dt>
        <dd>{{ profile.joinedAt }}</dd>
      </div>
    </dl>

    <p class="account-profile-privacy-note">邮箱和手机号码属于私密资料，公共个人主页不会展示。</p>
  </section>
</template>
