<script setup>
import { onMounted, ref } from 'vue'
import ChapterPicker from './ChapterPicker.vue'
import { getCurriculumCatalog } from '../../services/curriculumService.js'
const props = defineProps({ modelValue: Object, suggestions: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const catalog = ref(null),
  error = ref('')
onMounted(async () => {
  try {
    catalog.value = await getCurriculumCatalog()
  } catch (e) {
    error.value = e.message
  }
})
function change(chapters) {
  emit('update:modelValue', { version: 'PEP-A-2019', chapters, confirmed: false })
}
function confirm(confirmed) {
  emit('update:modelValue', {
    version: 'PEP-A-2019',
    chapters: props.modelValue?.chapters || [],
    confirmed,
  })
}
</script>
<template>
  <section class="curriculum-editor">
    <details>
      <summary>
        所需知识：{{ modelValue?.chapters?.length ? modelValue.chapters.join('、') : '待标注' }} ·
        {{ modelValue?.confirmed ? '已确认' : '待确认' }} <span>修改</span>
      </summary>
      <p v-if="error" role="alert">{{ error }}</p>
      <p>勾选解题必需的全部章节，并核对确认。</p>
      <p v-if="suggestions.length">
        按已保存的知识点标签建议：{{ suggestions.join('、') }}（仅供参考）
        <button type="button" @click="change(suggestions)">采用建议并人工核对</button>
      </p>
      <ChapterPicker
        v-if="catalog"
        :model-value="modelValue?.chapters || []"
        :catalog="catalog"
        @update:model-value="change"
      />
      <label class="confirmation"
        ><input
          type="checkbox"
          :checked="modelValue?.confirmed || false"
          :disabled="!modelValue?.chapters?.length"
          @change="confirm($event.target.checked)"
        />
        我已核对解法，以上章节完整且必需（审核发布后生效）
      </label>
    </details>
  </section>
</template>
<style scoped>
.curriculum-editor {
  border: 1px solid #cbd9e5;
  border-radius: 6px;
  padding: 14px;
  margin: 12px 0;
}
summary {
  cursor: pointer;
  font-size: 13px;
}
summary span {
  margin-left: 12px;
  color: #245b96;
}
p {
  font-size: 13px;
  line-height: 1.7;
}
h4 {
  margin: 0 0 10px;
}
.confirmation {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: flex-start;
  margin-top: 14px;
}
.confirmation input {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  min-height: 0;
}
</style>
