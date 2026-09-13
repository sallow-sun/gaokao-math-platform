<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../../services/apiClient.js'
const props = defineProps({ number: { type: String, required: true } })
const route = useRoute(),
  router = useRouter(),
  included = ref(null),
  busy = ref(false),
  error = ref('')
async function load() {
  busy.value = true
  try {
    included.value = (
      await apiRequest(`/api/v1/users/me/mistakes/${encodeURIComponent(props.number)}`)
    ).included
  } catch (e) {
    if (e.status === 401) included.value = false
    else error.value = e.message
  } finally {
    busy.value = false
  }
}
async function toggle() {
  if (busy.value) return
  error.value = ''
  if (included.value === null) {
    await load()
    if (included.value === null) return
  }
  busy.value = true
  try {
    await apiRequest(`/api/v1/users/me/mistakes/${encodeURIComponent(props.number)}`, {
      method: included.value ? 'DELETE' : 'PUT',
    })
    included.value = !included.value
  } catch (e) {
    if (e.status === 401) router.push({ name: 'login', query: { redirect: route.fullPath } })
    else error.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>
<template>
  <button type="button" :disabled="busy" :aria-pressed="included === true" @click="toggle">
    {{ busy ? '处理中…' : included ? '移出错题' : '加入错题' }}</button
  ><span v-if="error" class="question-mistake-error" role="alert">{{ error }}</span>
</template>
