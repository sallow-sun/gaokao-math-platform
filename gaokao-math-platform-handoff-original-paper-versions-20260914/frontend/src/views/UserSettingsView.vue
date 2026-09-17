<script setup>
import UserPreferenceSettings from '../components/account/UserPreferenceSettings.vue'
import UserSecuritySettings from '../components/account/UserSecuritySettings.vue'
import UserSettingsLayout from '../components/account/UserSettingsLayout.vue'

defineProps({
  activeTab: {
    type: String,
    required: true,
    validator: (value) => ['preferences', 'security'].includes(value),
  },
})
</script>

<template>
  <UserSettingsLayout :active-tab="activeTab">
    <UserPreferenceSettings v-if="activeTab === 'preferences'" />
    <UserSecuritySettings v-else />
  </UserSettingsLayout>
</template>
