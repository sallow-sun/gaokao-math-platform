<script setup>
import { ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
const userId = ref(''),
  data = ref(null),
  busy = ref(false),
  error = ref(''),
  target = ref(null),
  reason = ref(''),
  loadedUser = ref('')
async function load(page = 1) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (!/^[1-9]\d*$/.test(userId.value)) throw new Error('请输入数字用户 ID')
    const result = await apiRequest(`/api/v1/admin/growth/users/${userId.value}?page=${page}`)
    data.value = result
    loadedUser.value = String(result.user.id)
    target.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
function select(entry) {
  target.value = entry
  reason.value = ''
}
async function revoke() {
  if (busy.value || !target.value) return
  busy.value = true
  error.value = ''
  try {
    await apiRequest(`/api/v1/admin/growth/events/${target.value.id}/revoke`, {
      method: 'POST',
      body: { reason: reason.value },
    })
    target.value = null
    userId.value = loadedUser.value
    busy.value = false
    await load(data.value.history.page)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <details class="admin-growth">
    <summary>等级与经验管理</summary>
    <form @submit.prevent="load()">
      <label
        >数字用户 ID
        <input
          v-model.trim="userId"
          inputmode="numeric"
          required
          aria-label="查询经验的用户ID" /></label
      ><button :disabled="busy">查询经验</button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="data"
      ><h3>
        {{ data.user.username }} · Lv.{{ data.history.summary.level }} ·
        {{ data.history.summary.experience }} 经验
      </h3>
      <p>仅撤回重复或违规获得的经验，原因会展示给用户。相同记录重复撤回不会再次扣分。</p>
      <article v-for="entry in data.history.items" :key="entry.id">
        <div>
          {{ entry.description
          }}<small>{{ new Date(entry.created_at).toLocaleString('zh-CN') }}</small>
        </div>
        <strong>{{ entry.points > 0 ? '+' : '' }}{{ entry.points }}</strong
        ><button v-if="entry.points > 0" :disabled="busy" @click="select(entry)">撤回此条</button>
      </article>
      <p v-if="!data.history.items.length">暂无经验记录。</p>
      <form v-if="target" class="admin-growth-confirm" @submit.prevent="revoke">
        <p>撤回“{{ target.description }}”获得的 {{ target.points }} 经验</p>
        <label>撤回原因<textarea v-model.trim="reason" required maxlength="300" rows="2" /></label
        ><button :disabled="busy || !reason">确认撤回</button
        ><button type="button" :disabled="busy" @click="target = null">取消</button>
      </form>
      <footer v-if="data.history.total">
        <button :disabled="busy || data.history.page <= 1" @click="load(data.history.page - 1)">
          上一页</button
        ><span>{{ data.history.page }} / {{ Math.ceil(data.history.total / 20) }}</span
        ><button
          :disabled="busy || data.history.page * 20 >= data.history.total"
          @click="load(data.history.page + 1)"
        >
          下一页
        </button>
      </footer></template
    >
  </details>
</template>
<style scoped>
.admin-growth {
  margin: 20px 0;
  background: white;
  border: 1px solid #cbd6e0;
  border-radius: 6px;
  padding: 20px;
  color: #365a78;
  font-size: 14px;
}
.admin-growth summary {
  cursor: pointer;
  font-weight: 600;
}
.admin-growth form {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}
.admin-growth label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.admin-growth input,
.admin-growth textarea {
  font: inherit;
  border: 1px solid #cbd6e0;
  padding: 8px;
  border-radius: 4px;
}
.admin-growth button {
  border: 1px solid #cbd6e0;
  background: #fff;
  color: #205b87;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}
.admin-growth button:disabled {
  opacity: 0.5;
}
.admin-growth article {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 0;
  border-bottom: 1px solid #e4ebf0;
}
.admin-growth article > div {
  flex: 1;
}
.admin-growth small {
  display: block;
  margin-top: 5px;
  color: #8397a5;
  font-size: 11px;
}
.admin-growth p {
  font-size: 12px;
  color: #7890a0;
}
.admin-growth-confirm {
  padding: 14px;
  background: #fff8ed;
}
.admin-growth-confirm > p {
  width: 100%;
}
.admin-growth footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
}
</style>
