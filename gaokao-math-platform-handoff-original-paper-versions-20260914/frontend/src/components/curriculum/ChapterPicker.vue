<script setup>
import { computed } from 'vue'
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  catalog: Object,
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const books = computed(() => [...new Set((props.catalog?.chapters || []).map((c) => c.book))])
function toggle(codes, checked) {
  emit(
    'update:modelValue',
    checked
      ? [...new Set([...props.modelValue, ...codes])]
      : props.modelValue.filter((c) => !codes.includes(c)),
  )
}
</script>
<template>
  <div class="chapter-picker">
    <fieldset v-for="book in books" :key="book" :disabled="disabled">
      <legend>{{ book }}</legend>
      <button
        type="button"
        @click="
          toggle(
            catalog.chapters.filter((c) => c.book === book).map((c) => c.code),
            true,
          )
        "
      >
        选中整册
      </button>
      <button
        type="button"
        @click="
          toggle(
            catalog.chapters.filter((c) => c.book === book).map((c) => c.code),
            false,
          )
        "
      >
        清除本册
      </button>
      <label v-for="chapter in catalog.chapters.filter((c) => c.book === book)" :key="chapter.code">
        <input
          type="checkbox"
          :checked="modelValue.includes(chapter.code)"
          @change="toggle([chapter.code], $event.target.checked)"
        />
        <span
          ><code>{{ chapter.code }}</code> {{ chapter.title }}</span
        >
      </label>
    </fieldset>
  </div>
</template>
<style scoped>
.chapter-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 12px;
}
.chapter-picker fieldset {
  min-width: 0;
  margin: 0;
  padding: 12px;
  border: 1px solid #d8e2eb;
  border-radius: 6px;
}
.chapter-picker legend {
  padding: 0 5px;
  font-weight: 600;
}
.chapter-picker label {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 1.6;
}
.chapter-picker input[type='checkbox'] {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  min-height: 0;
  margin-top: 4px;
}
.chapter-picker button {
  margin: 0 8px 6px 0;
  font-size: 12px;
  cursor: pointer;
}
.chapter-picker code {
  color: #45617b;
  font-size: 12px;
}
</style>
