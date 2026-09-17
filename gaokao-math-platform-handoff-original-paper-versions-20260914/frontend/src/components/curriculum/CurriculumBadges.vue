<script setup>
import { onMounted, ref } from 'vue'
import { getCurriculumCatalog } from '../../services/curriculumService.js'
defineProps({ annotation: Object })
const catalog = ref(null)
onMounted(async () => {
  try {
    catalog.value = await getCurriculumCatalog()
  } catch {
    /* codes remain readable */
  }
})
</script>
<template>
  <details v-if="annotation?.confirmed" class="curriculum-badges">
    <summary>所需知识</summary>
    <template
      ><span v-for="code in annotation.chapters" :key="code">{{
        catalog?.chapters.find((c) => c.code === code)?.title || '教材章节'
      }}</span></template
    >
  </details>
</template>
<style scoped>
.curriculum-badges {
  display: block;
  gap: 6px 12px;
  margin-top: 12px;
  color: #526c80;
  font: 13px/1.7 sans-serif;
}
summary {
  cursor: pointer;
}
span {
  display: inline-block;
  margin-right: 12px;
}
</style>
