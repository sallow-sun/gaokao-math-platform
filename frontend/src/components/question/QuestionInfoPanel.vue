<script setup>
import { computed } from 'vue'
import QuestionActions from './QuestionActions.vue'

const props = defineProps({
  completed: {
    type: Boolean,
    default: false,
  },
  favorite: {
    type: Boolean,
    default: false,
  },
  problem: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['toggle-completed', 'toggle-favorite'])

const informationItems = computed(() => [
  { label: '题目编号', value: props.problem.id },
  {
    label: '来源',
    value: [props.problem.year, props.problem.sourceLabel].filter(Boolean).join('') || '未知',
  },
  { label: '上传者', value: props.problem.uploader || '待接入' },
])

const levelLabel = computed(() => String(props.problem.level || '未知').toUpperCase())
</script>

<template>
  <section class="question-info-panel" aria-label="题目信息">
    <dl class="question-info-list">
      <div v-for="item in informationItems" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd>{{ item.value }}</dd>
      </div>

      <div>
        <dt>题目难度</dt>
        <dd class="question-info-level" :data-level-color="problem.level">
          {{ levelLabel }}
        </dd>
      </div>
    </dl>

    <QuestionActions
      :problem-number="problem.id"
      :completed="completed"
      :favorite="favorite"
      @toggle-completed="emit('toggle-completed')"
      @toggle-favorite="emit('toggle-favorite')"
    />
  </section>
</template>
