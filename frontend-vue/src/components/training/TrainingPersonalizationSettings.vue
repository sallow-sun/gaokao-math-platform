<script setup>
import PersonalizationDialog from '../personalization/PersonalizationDialog.vue'
import ProblemActionConfirmationSettings from '../personalization/ProblemActionConfirmationSettings.vue'
import ProblemPrintSettings from '../personalization/ProblemPrintSettings.vue'
import { PROBLEMS_ACTION_CONFIRMATION_OPTIONS } from '../../composables/useProblemsActionPreferences.js'

const COMPLETION_CONFIRMATION_OPTIONS = PROBLEMS_ACTION_CONFIRMATION_OPTIONS.filter((option) =>
  ['markCompleted', 'unmarkCompleted'].includes(option.value),
)

defineProps({
  actionConfirmations: { type: Object, required: true },
  includeNotes: { type: Boolean, default: true },
  includePrintHeader: { type: Boolean, default: false },
  printOptions: { type: Object, required: true },
  printOptionOptions: { type: Array, required: true },
  printPageLayout: { type: String, default: 'auto' },
  printPageLayoutOptions: { type: Array, required: true },
})

const emit = defineEmits([
  'action-confirmation-change',
  'include-notes-change',
  'include-print-header-change',
  'print-option-change',
  'print-page-layout-change',
  'print-preset-change',
])
</script>

<template>
  <div class="training-personalization-settings">
    <PersonalizationDialog
      dialog-id="training-personalization-settings-dialog"
      title="题单个性化设置"
      toggle-aria-label="题单个性化设置"
      toggle-class="training-personalization-settings-toggle"
    >
      <template #toggle>
        <span class="training-personalization-settings-icon" aria-hidden="true">⚙︎</span>
      </template>

      <ProblemPrintSettings
        :include-header="includePrintHeader"
        :include-notes="includeNotes"
        :options="printOptions"
        :option-options="printOptionOptions"
        :page-layout="printPageLayout"
        :page-layout-options="printPageLayoutOptions"
        show-notes-option
        @include-header-change="emit('include-print-header-change', $event)"
        @include-notes-change="emit('include-notes-change', $event)"
        @option-change="emit('print-option-change', $event)"
        @page-layout-change="emit('print-page-layout-change', $event)"
        @preset-change="emit('print-preset-change', $event)"
      />

      <ProblemActionConfirmationSettings
        :confirmations="actionConfirmations"
        :options="COMPLETION_CONFIRMATION_OPTIONS"
        @change="emit('action-confirmation-change', $event)"
      />
    </PersonalizationDialog>
  </div>
</template>
