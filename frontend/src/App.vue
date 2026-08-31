<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { usePracticeListsStore } from './stores/practiceLists.js'
import StudyNavigation from './components/navigation/StudyNavigation.vue'
import ProblemPrintHost from './components/print/ProblemPrintHost.vue'

const route = useRoute()
const practiceListsStore = usePracticeListsStore()
const showStudyNavigation = computed(() => Boolean(route.meta.studyNavigation))

function refreshVisibleSession() {
  if (document.visibilityState === 'visible') {
    practiceListsStore.initialize({ force: true })
  }
}

onMounted(() => {
  practiceListsStore.initialize()
  document.addEventListener('visibilitychange', refreshVisibleSession)
})

onUnmounted(() => document.removeEventListener('visibilitychange', refreshVisibleSession))
</script>

<template>
  <div class="study-shell" :class="{ 'has-study-navigation': showStudyNavigation }">
    <StudyNavigation v-if="showStudyNavigation" />
    <div class="study-shell-content">
      <RouterView />
    </div>
  </div>
  <ProblemPrintHost />
</template>
