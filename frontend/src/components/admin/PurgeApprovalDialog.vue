<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
const props = defineProps({ items: { type: Array, required: true } })
const emit = defineEmits(['close', 'purged'])
const dialog = ref(null),
  account = ref(''),
  password = ref(''),
  accepted = ref(false),
  busy = ref(false),
  error = ref('')
const targets = props.items.map(({ kind, id, generation }) => ({ kind, id, generation }))
onMounted(() => dialog.value.showModal())
onBeforeUnmount(() => {
  password.value = ''
})
function close() {
  if (busy.value) return
  password.value = ''
  emit('close')
}
async function submit() {
  if (busy.value || !accepted.value) return
  busy.value = true
  error.value = ''
  const secret = password.value
  password.value = ''
  try {
    await apiRequest('/api/v1/admin/problem-trash/purge', {
      method: 'POST',
      body: {
        items: targets,
        account: account.value.trim(),
        password: secret,
        confirmation: '彻底删除',
      },
    })
    emit('purged', targets.length)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="purge-approval"
      aria-labelledby="purge-title"
      @cancel.prevent="close"
    >
      <form @submit.prevent="submit">
        <header>
          <h3 id="purge-title">彻底删除 {{ items.length }} 题</h3>
          <button type="button" aria-label="关闭认证" :disabled="busy" @click="close">×</button>
        </header>
        <p>删除后无法从回收站恢复。请另一位管理员核对以下题目，并亲自完成认证。</p>
        <ul class="purge-targets">
          <li v-for="item in items" :key="`${item.kind}:${item.id}`">
            <small
              >{{ item.kind === 'draft' ? '草稿' : '已发布' }} ·
              {{ item.number || (item.kind === 'published' ? item.id : '未发布') }}</small
            ><span>{{ item.title }}</span>
          </li>
        </ul>
        <label
          >另一位管理员账号<input
            v-model="account"
            required
            maxlength="254"
            autocomplete="off"
            placeholder="用户名、UID 或邮箱"
            :disabled="busy"
        /></label>
        <label
          >管理员密码<input
            v-model="password"
            required
            type="password"
            maxlength="128"
            autocomplete="off"
            :disabled="busy"
        /></label>
        <small>仅用于本次删除认证，不切换当前账号。</small>
        <label class="purge-ack"
          ><input
            v-model="accepted"
            type="checkbox"
            :disabled="busy"
          />我已核对所选题目，确认彻底删除且不可恢复</label
        >
        <p v-if="error" role="alert">{{ error }}</p>
        <footer>
          <button type="button" :disabled="busy" @click="close">取消</button
          ><button
            class="purge-danger"
            :disabled="busy || !accepted || !account.trim() || !password"
          >
            {{ busy ? '正在认证并删除…' : '认证并彻底删除' }}
          </button>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>
<style scoped>
.purge-approval {
  margin: auto;
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  box-sizing: border-box;
  padding: 24px;
  border: 1px solid #cad8e3;
  border-radius: 12px;
  color: #23465f;
  background: white;
  box-shadow: 0 16px 64px #102c4840;
}
.purge-approval::backdrop {
  background: #142c4866;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h3 {
  margin: 0;
  font-size: 20px;
}
p,
small {
  line-height: 1.6;
}
small {
  color: #60768a;
}
label {
  display: grid;
  gap: 8px;
  margin: 16px 0 8px;
}
input:not([type='checkbox']) {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #bacbd9;
  border-radius: 5px;
  font: inherit;
}
.purge-targets {
  max-height: 180px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  border-block: 1px solid #e1e8ef;
}
li {
  display: grid;
  gap: 4px;
  padding: 8px 0;
  overflow-wrap: anywhere;
}
.purge-ack {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.6;
}
footer {
  justify-content: flex-end;
  margin-top: 24px;
}
button {
  padding: 9px 14px;
  border: 1px solid #bacbd9;
  border-radius: 5px;
  background: white;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.purge-danger {
  background: #a73735;
  border-color: #a73735;
  color: white;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
[role='alert'] {
  color: #a73735;
}
</style>
