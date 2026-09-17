<script setup>
import AdminPagination from './AdminPagination.vue'

defineProps({
  error: {
    type: String,
    default: '',
  },
  keyword: {
    type: String,
    required: true,
  },
  pendingUserId: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  pagination: {
    type: Object,
    required: true,
  },
  users: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['delete-request', 'keyword-change', 'page-change', 'retry', 'status-request'])

function roleLabel(role) {
  return role === 'admin' ? '管理员' : '学生'
}

function statusLabel(status) {
  return status === 'banned' ? '已封禁' : '正常'
}
</script>

<template>
  <section
    id="admin-panel-users"
    class="admin-panel"
    role="tabpanel"
    aria-labelledby="admin-tab-users"
    tabindex="0"
  >
    <header class="admin-panel-header">
      <div>
        <h2>用户管理</h2>
        <p>用户状态直接保存到数据库；被封禁用户的现有会话会失效。</p>
      </div>
      <label class="admin-search-field">
        <span class="sr-only">搜索用户</span>
        <input
          type="search"
          :value="keyword"
          placeholder="搜索用户名或 UID"
          @input="emit('keyword-change', $event.target.value)"
        />
      </label>
    </header>

    <div class="admin-table-container" :aria-busy="loading">
      <table>
        <thead>
          <tr>
            <th scope="col">用户</th>
            <th scope="col">UID</th>
            <th scope="col">角色</th>
            <th scope="col">加入时间</th>
            <th scope="col">状态</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="admin-empty-cell" role="status">正在读取用户……</td>
          </tr>
          <tr v-else-if="error">
            <td colspan="6" class="admin-empty-cell is-error">
              <p>{{ error }}</p>
              <button type="button" class="admin-inline-action" @click="emit('retry')">
                重新读取用户
              </button>
            </td>
          </tr>
          <tr v-for="user in loading || error ? [] : users" :key="user.id">
            <td>
              <strong>{{ user.username }}</strong>
            </td>
            <td>
              <code>{{ user.uid }}</code>
            </td>
            <td>{{ roleLabel(user.role) }}</td>
            <td>{{ user.joinedAt }}</td>
            <td>
              <span :class="['admin-status', `is-${user.status}`]">
                {{ statusLabel(user.status) }}
              </span>
            </td>
            <td>
              <div class="admin-row-actions">
                <button
                  type="button"
                  :class="['admin-inline-action', { 'is-danger': user.status !== 'banned' }]"
                  :disabled="user.role === 'admin' || pendingUserId === user.id"
                  @click="emit('status-request', user)"
                >
                  {{ user.status === 'banned' ? '解除封禁' : '封禁' }}
                </button>
                <button
                  type="button"
                  class="admin-inline-action is-danger"
                  :disabled="user.role === 'admin' || pendingUserId === user.id"
                  @click="emit('delete-request', user)"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !error && users.length === 0">
            <td colspan="6" class="admin-empty-cell">没有符合条件的用户</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination
      v-if="!loading && !error"
      label="用户列表"
      :pagination="pagination"
      @page-change="emit('page-change', $event)"
    />
  </section>
</template>
