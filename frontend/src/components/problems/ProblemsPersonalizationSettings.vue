<script setup>
import PersonalizationDialog from '../personalization/PersonalizationDialog.vue'
import ProblemActionConfirmationSettings from '../personalization/ProblemActionConfirmationSettings.vue'
import ProblemPrintSettings from '../personalization/ProblemPrintSettings.vue'

defineProps({
  actionConfirmations: { type: Object, required: true },
  displayOptions: { type: Object, required: true },
  displayOptionOptions: { type: Array, required: true },
  includePrintHeader: { type: Boolean, default: false },
  printOptions: { type: Object, required: true },
  printOptionOptions: { type: Array, required: true },
  printPageLayout: { type: String, default: 'auto' },
  printPageLayoutOptions: { type: Array, required: true },
})

const emit = defineEmits([
  'action-confirmation-change',
  'display-option-change',
  'display-options-all',
  'display-options-minimal',
  'include-print-header-change',
  'print-option-change',
  'print-page-layout-change',
  'print-preset-change',
])
</script>

<template>
  <PersonalizationDialog
    dialog-id="bank-personalization-settings-dialog"
    title="个性化设置"
    description="统一调整题目显示、打印内容和操作确认。"
  >
    <section class="bank-personalization-section" aria-labelledby="display-options-title">
      <header>
        <div><h3 id="display-options-title">页面显示</h3></div>
      </header>
      <div class="bank-display-filter-options">
        <label v-for="option in displayOptionOptions" :key="option.value">
          <input
            type="checkbox"
            :checked="displayOptions[option.value]"
            @change="
              emit('display-option-change', { name: option.value, visible: $event.target.checked })
            "
          />
          <span>{{ option.label }}</span>
        </label>
      </div>
      <footer class="bank-personalization-section-footer">
        <button type="button" @click="emit('display-options-minimal')">全部隐藏</button>
        <button type="button" @click="emit('display-options-all')">全部显示</button>
      </footer>
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
</template>
