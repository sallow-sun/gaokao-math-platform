<script setup>
import PersonalizationDialog from '../personalization/PersonalizationDialog.vue'
import ProblemActionConfirmationSettings from '../personalization/ProblemActionConfirmationSettings.vue'
import ProblemPrintSettings from '../personalization/ProblemPrintSettings.vue'

defineProps({
  actionConfirmations: { type: Object, required: true },
  answerPlacement: { type: String, required: true },
  answerPlacementOptions: { type: Array, required: true },
  includePrintHeader: { type: Boolean, default: false },
  printOptions: { type: Object, required: true },
  printOptionOptions: { type: Array, required: true },
  printPageLayout: { type: String, default: 'auto' },
  printPageLayoutOptions: { type: Array, required: true },
  typeColorMode: { type: String, required: true },
  typeColorOptions: { type: Array, required: true },
})

const emit = defineEmits([
  'action-confirmation-change',
  'answer-placement-change',
  'include-print-header-change',
  'print-option-change',
  'print-page-layout-change',
  'print-preset-change',
  'type-color-change',
])
</script>

<template>
  <div class="question-personalization-settings">
    <PersonalizationDialog
      dialog-id="question-personalization-dialog"
      title="个性化设置"
      description="调整单题页面显示、打印内容和操作确认。"
      toggle-aria-label="打开题目个性化设置"
      toggle-class="question-personalization-toggle"
    >
      <template #toggle>个性化</template>

      <section
        class="bank-personalization-section"
        aria-labelledby="question-answer-placement-title"
      >
        <header>
          <div><h3 id="question-answer-placement-title">答案解析位置</h3></div>
        </header>
        <div class="bank-display-filter-options">
          <label v-for="option in answerPlacementOptions" :key="option.value">
            <input
              type="radio"
              name="question-answer-placement"
              :value="option.value"
              :checked="answerPlacement === option.value"
              @change="emit('answer-placement-change', option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </section>

      <section class="bank-personalization-section" aria-labelledby="question-type-color-title">
        <header>
          <div><h3 id="question-type-color-title">题型颜色</h3></div>
        </header>
        <div class="bank-display-filter-options">
          <label v-for="option in typeColorOptions" :key="option.value">
            <input
              type="radio"
              name="question-type-color"
              :value="option.value"
              :checked="typeColorMode === option.value"
              @change="emit('type-color-change', option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </section>

      <ProblemPrintSettings
        :include-header="includePrintHeader"
        :options="printOptions"
        :option-options="printOptionOptions"
        :page-layout="printPageLayout"
        :page-layout-options="printPageLayoutOptions"
        @include-header-change="emit('include-print-header-change', $event)"
        @option-change="emit('print-option-change', $event)"
        @page-layout-change="emit('print-page-layout-change', $event)"
        @preset-change="emit('print-preset-change', $event)"
      />

      <ProblemActionConfirmationSettings
        :confirmations="actionConfirmations"
        @change="emit('action-confirmation-change', $event)"
      />
    </PersonalizationDialog>
  </div>
</template>
