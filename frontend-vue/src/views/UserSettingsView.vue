<script setup>
import UserPreferenceSettings from '../components/account/UserPreferenceSettings.vue'
import UserProfileSettings from '../components/account/UserProfileSettings.vue'
import UserSecuritySettings from '../components/account/UserSecuritySettings.vue'
import UserSettingsLayout from '../components/account/UserSettingsLayout.vue'

defineProps({
  activeTab: {
    type: String,
    required: true,
    validator: (value) => ['profile', 'preferences', 'security'].includes(value),
  },
})
</script>

<template>
  <UserSettingsLayout :active-tab="activeTab">
    <UserProfileSettings v-if="activeTab === 'profile'" />
    <UserPreferenceSettings v-else-if="activeTab === 'preferences'" />
    <UserSecuritySettings v-else />
  </UserSettingsLayout>
</template>
