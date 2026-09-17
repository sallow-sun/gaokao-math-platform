<script setup>
import { ref } from 'vue'

defineProps({
  autocomplete: {
    type: String,
    default: 'current-password',
  },
  fieldId: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  modelValue: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    required: true,
  },
  placeholder: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
const isVisible = ref(false)
</script>

<template>
  <div class="account-form-group">
    <label :for="fieldId">{{ label }}</label>
    <div class="account-password-field">
      <input
        :id="fieldId"
        :name="name"
        :type="isVisible ? 'text' : 'password'"
        :value="modelValue"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <button
        type="button"
        :aria-label="isVisible ? `隐藏${label}` : `显示${label}`"
        :aria-pressed="isVisible"
        @click="isVisible = !isVisible"
      >
        {{ isVisible ? '隐藏' : '显示' }}
      </button>
    </div>
  </div>
</template>
