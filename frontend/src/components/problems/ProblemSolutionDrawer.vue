<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  problem: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close'])
</script>

<template>
  <Transition name="bank-solution-drawer">
    <section
      v-if="open"
      :id="`problem-solution-${problem.id}`"
      class="bank-problem-solution-drawer"
      :aria-labelledby="`problem-solution-title-${problem.id}`"
    >
      <header class="bank-problem-solution-drawer-header">
        <div>
          <h4 :id="`problem-solution-title-${problem.id}`">题目 {{ problem.id }} 的题解</h4>
          <span>独立题解页待接入</span>
        </div>
        <button type="button" :aria-label="`收起题目 ${problem.id} 的题解`" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="bank-problem-solution-placeholder">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.5 8.5a3.7 3.7 0 1 1 6.2 2.7c-1.4 1.2-2.7 1.8-2.7 3.4" />
          <path d="M12 18.5h.01" />
          <circle cx="12" cy="12" r="9.5" />
        </svg>
        <div>
          <strong>题解页面尚未制作</strong>
          <p>后续将在这里加载该题的独立题解页面；当前先保留快速展开的位置和交互。</p>
        </div>
      </div>
    </section>
  </Transition>
</template>
