<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  filterKey: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  modelValue: {
    type: [String, Array],
    default: '',
  },
  multiple: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Array,
    required: true,
  },
  colorized: {
    type: Boolean,
    default: false,
  },
  moreOptions: {
    type: Array,
    default: () => [],
  },
  popoverTitle: {
    type: String,
    default: '',
  },
  pinnable: {
    type: Boolean,
    default: false,
  },
  pinnedValues: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['pin-change', 'select'])
const root = ref(null)
const moreButton = ref(null)
const isPopoverOpen = ref(false)

const selectedValues = computed(() => {
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.filter((value) => typeof value === 'string' && value)
  }

  return props.modelValue ? [props.modelValue] : []
})

const hiddenSelectionCount = computed(() => {
  const mainValues = new Set(props.options.map((option) => option.value))
  const catalogValues = new Set(props.moreOptions.map((option) => option.value))

  return selectedValues.value.filter((value) => !mainValues.has(value) && catalogValues.has(value))
    .length
})

function isOptionSelected(value) {
  return value ? selectedValues.value.includes(value) : selectedValues.value.length === 0
}

function closePopover(shouldRestoreFocus = false) {
  isPopoverOpen.value = false

  if (shouldRestoreFocus) {
    moreButton.value?.focus()
  }
}

async function togglePopover() {
  isPopoverOpen.value = !isPopoverOpen.value

  if (isPopoverOpen.value) {
    await nextTick()
    root.value?.querySelector('.bank-filter-catalog-choice')?.focus()
  }
}

function selectOption(value, isCatalogChoice = false) {
  if (!props.multiple) {
    emit('select', value)

    if (isCatalogChoice) {
      closePopover()
    }

    return
  }

  if (!value) {
    emit('select', [])
    return
  }

  const nextValues = selectedValues.value.includes(value)
    ? selectedValues.value.filter((selectedValue) => selectedValue !== value)
    : [...selectedValues.value, value]

  emit('select', nextValues)
}

function handlePinChange(value, event) {
  emit('pin-change', { value, pinned: event.target.checked })
}

function handlePointerDown(event) {
  if (isPopoverOpen.value && !root.value?.contains(event.target)) {
    closePopover()
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && isPopoverOpen.value) {
    event.preventDefault()
    closePopover(true)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    ref="root"
    class="bank-filter-group"
    :class="{ 'bank-filter-level-group': colorized }"
    role="group"
    :aria-labelledby="`bank-filter-${filterKey}-label`"
  >
    <span :id="`bank-filter-${filterKey}-label`" class="bank-filter-group-label">
      {{ label }}
    </span>

    <div class="bank-filter-control">
      <div class="bank-filter-options" :class="{ 'bank-filter-level-options': colorized }">
        <button
          v-for="option in options"
          :key="`${filterKey}-${option.value || 'all'}`"
          type="button"
          :class="{ 'is-active': isOptionSelected(option.value) }"
          :data-level-color="colorized ? option.value || undefined : undefined"
          :aria-pressed="isOptionSelected(option.value)"
          @click="selectOption(option.value)"
        >
          {{ option.label }}
        </button>

        <button
          v-if="moreOptions.length"
          ref="moreButton"
          class="bank-filter-more"
          :class="{ 'has-hidden-selection': hiddenSelectionCount > 0 }"
          type="button"
          :aria-expanded="isPopoverOpen"
          :aria-controls="`bank-filter-${filterKey}-popover`"
          @click="togglePopover"
        >
          <span>更多</span>
          <span v-if="hiddenSelectionCount" class="bank-filter-more-count">
            {{ hiddenSelectionCount }}
          </span>
        </button>
      </div>

      <div
        v-if="moreOptions.length"
        v-show="isPopoverOpen"
        :id="`bank-filter-${filterKey}-popover`"
        class="bank-filter-popover"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="`bank-filter-${filterKey}-popover-title`"
      >
        <header class="bank-filter-popover-header">
          <div>
            <h3 :id="`bank-filter-${filterKey}-popover-title`">
              {{ popoverTitle || `所有${label}` }}
            </h3>
            <p v-if="pinnable">选择{{ label }}；勾选“显示在筛选栏”可设为常用项。</p>
            <p v-else>从完整列表中选择一个选项。</p>
          </div>
          <button
            class="bank-filter-popover-close"
            type="button"
            :aria-label="`关闭${label}小窗`"
            @click="closePopover(true)"
          >
            ×
          </button>
        </header>

        <div
          class="bank-filter-catalog-list"
          :class="{ 'bank-filter-year-catalog': filterKey === 'year' }"
        >
          <div
            v-for="option in moreOptions"
            :key="`${filterKey}-catalog-${option.value || 'all'}`"
            class="bank-filter-catalog-item"
            :class="{ 'has-active-choice': isOptionSelected(option.value) }"
          >
            <button
              class="bank-filter-catalog-choice"
              type="button"
              :class="{ 'is-active': isOptionSelected(option.value) }"
              :aria-pressed="isOptionSelected(option.value)"
              @click="selectOption(option.value, true)"
            >
              {{ option.label }}
            </button>

            <span v-if="pinnable && !option.value" class="bank-filter-pin-fixed"> 始终显示 </span>
            <label v-else-if="pinnable" class="bank-filter-pin-control">
              <input
                type="checkbox"
                :checked="pinnedValues.includes(option.value)"
                @change="handlePinChange(option.value, $event)"
              />
              <span>显示在筛选栏</span>
            </label>
          </div>
        </div>

        <footer class="bank-filter-popover-footer">
          <span v-if="pinnable">固定设置仅保存在当前浏览器。“全部”始终固定显示。</span>
          <span v-else>完整选项范围来自当前前端原型。</span>
          <button type="button" @click="closePopover(true)">完成</button>
        </footer>
      </div>
    </div>
  </div>
</template>
