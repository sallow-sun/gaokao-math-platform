<script setup>
import { computed } from 'vue'
import QuestionAnswerSection from './QuestionAnswerSection.vue'
import QuestionInfoPanel from './QuestionInfoPanel.vue'
import QuestionSidebarSection from './QuestionSidebarSection.vue'

const props = defineProps({
  answerPlacement: {
    type: String,
    default: 'sidebar',
  },
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

const tags = computed(() =>
  Array.isArray(props.problem.tags)
    ? props.problem.tags.filter((tag) => typeof tag === 'string' && tag.trim())
    : [],
)
</script>

<template>
  <div class="question-sidebar-stack">
    <QuestionInfoPanel
      :completed="completed"
      :favorite="favorite"
      :problem="problem"
      @toggle-completed="emit('toggle-completed')"
      @toggle-favorite="emit('toggle-favorite')"
    />

    <QuestionAnswerSection v-if="answerPlacement === 'sidebar'" :problem="problem" />

    <QuestionSidebarSection
      section-id="question-tags"
      title="标签"
      collapsed-text="显示题目标签"
      expanded-text="收起题目标签"
    >
      <ul v-if="tags.length" class="question-sidebar-tags">
        <li v-for="tag in tags" :key="tag">{{ tag }}</li>
      </ul>
      <p v-else class="question-sidebar-empty">当前题目没有原型标签。</p>
    </QuestionSidebarSection>

    <QuestionSidebarSection
      section-id="question-discussion"
      title="题目讨论"
      collapsed-text="查看讨论状态"
      expanded-text="收起讨论状态"
      header-action-label="进入讨论版"
      header-action-hint="讨论版路由尚未接入"
    >
      <p class="question-sidebar-empty">讨论功能及数据接口尚未接入。</p>
    </QuestionSidebarSection>

    <QuestionSidebarSection
      section-id="question-collections"
      title="本题收录于"
      collapsed-text="查看收录状态"
      expanded-text="收起收录状态"
    >
      <p class="question-sidebar-empty">题单收录数据接口尚未确定。</p>
    </QuestionSidebarSection>

    <QuestionSidebarSection
      section-id="question-recommendations"
      title="推荐题目"
      collapsed-text="查看推荐状态"
      expanded-text="收起推荐状态"
    >
      <p class="question-sidebar-empty">推荐题目数据接口尚未确定。</p>
    </QuestionSidebarSection>
  </div>
</template>
