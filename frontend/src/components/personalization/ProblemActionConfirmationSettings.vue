<script setup>
import { PROBLEMS_ACTION_CONFIRMATION_OPTIONS } from '../../composables/useProblemsActionPreferences.js'

defineProps({
  confirmations: {
    type: Object,
    required: true,
  },
  options: {
    type: Array,
    default: () => PROBLEMS_ACTION_CONFIRMATION_OPTIONS,
  },
})

const emit = defineEmits(['change'])
</script>

<template>
  <section class="bank-personalization-section" aria-labelledby="shared-action-options-title">
    <header>
      <div><h3 id="shared-action-options-title">操作确认</h3></div>
    </header>
    <div class="bank-action-confirmation-options">
      <label v-for="option in options" :key="option.value">
        <input
          type="checkbox"
          :checked="confirmations[option.value]"
          @change="emit('change', { name: option.value, enabled: $event.target.checked })"
        />
        <span>
          <strong>{{ option.label }}</strong>
          <small v-if="option.description">{{ option.description }}</small>
        </span>
      </label>
    </div>
  </section>
</template>
