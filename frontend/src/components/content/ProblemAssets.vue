<script setup>
const API_PREFIX = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

defineProps({
  assets: {
    type: Array,
    default: () => [],
  },
})

function assetUrl(url) {
  const value = String(url ?? '').trim()
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value
  return value.startsWith('/') ? `${API_PREFIX}${value}` : `${API_PREFIX}/${value}`
}
</script>

<template>
  <div v-if="assets.length" class="problem-assets" aria-label="题目配图">
    <figure v-for="asset in assets" :key="asset.id || asset.url" class="problem-asset">
      <img :src="assetUrl(asset.url)" :alt="asset.altText || '题目配图'" />
    </figure>
  </div>
</template>

<style scoped>
.problem-assets {
  display: grid;
  gap: 16px;
  margin-top: 18px;
}

.problem-asset {
  margin: 0;
  text-align: center;
}

.problem-asset img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 560px;
  margin-inline: auto;
  object-fit: contain;
}

@media print {
  .problem-assets {
    break-inside: avoid;
    margin-top: 10px;
  }

  .problem-asset img {
    max-height: 210mm;
  }
}
</style>
