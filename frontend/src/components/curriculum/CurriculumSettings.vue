<script setup>
import { onMounted, ref } from 'vue'
import ChapterPicker from './ChapterPicker.vue'
import { getCurriculumCatalog, updateCurriculumPreset } from '../../services/curriculumService.js'
const catalog = ref(null),
  message = ref(''),
  busy = ref(false)
async function load() {
  try {
    catalog.value = structuredClone(await getCurriculumCatalog(true))
  } catch (e) {
    message.value = e.message
  }
}
onMounted(load)
async function save(preset) {
  busy.value = true
  try {
    await updateCurriculumPreset(preset.id, { version: preset.version, chapters: preset.chapters })
    await load()
    message.value = '学期预设已保存。已分享的筛选链接保留原来选择的章节。'
  } catch (e) {
    message.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section>
    <h3>学期进度预设</h3>
    <p>
      由负责人根据教学安排维护。修改只影响以后选择此预设的用户，不改题目章节或已经分享的筛选链接。
    </p>
    <p role="status">{{ message }}</p>
    <details v-for="p in catalog?.presets || []" :key="p.id">
      <summary>{{ p.label }} · {{ p.chapters.length }} 章</summary>
      <ChapterPicker v-model="p.chapters" :catalog="catalog" :disabled="busy" />
      <button type="button" :disabled="busy" @click="save(p)">保存{{ p.label }}预设</button>
    </details>
  </section>
</template>
<style scoped>
details {
  border: 1px solid #cedce7;
  padding: 12px;
  margin: 12px 0;
}
summary {
  cursor: pointer;
  margin-bottom: 10px;
}
</style>
