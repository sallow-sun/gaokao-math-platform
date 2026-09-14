<script setup>
import { computed } from 'vue'
import MathText from '../content/MathText.vue'
const props = defineProps({
  text: { type: String, default: '' },
  assets: { type: Array, default: () => [] },
  base: { type: String, required: true },
})
const parts = computed(() => {
  const result = [],
    regex = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g
  let offset = 0
  for (const match of props.text.matchAll(regex)) {
    result.push({ text: props.text.slice(offset, match.index) })
    if (props.assets.some((a) => a.name === match[2]))
      result.push({ image: props.base + encodeURIComponent(match[2]), alt: match[1] })
    else result.push({ text: match[0] })
    offset = match.index + match[0].length
  }
  result.push({ text: props.text.slice(offset) })
  return result
})
</script>
<template>
  <template v-for="(part, i) in parts" :key="i"
    ><img
      v-if="part.image"
      :src="part.image"
      :alt="part.alt"
      style="max-width: 100%; height: auto" /><MathText v-else :text="part.text"
  /></template>
</template>
