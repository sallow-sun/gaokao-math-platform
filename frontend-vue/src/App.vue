<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import StudyNavigation from './components/navigation/StudyNavigation.vue'
import ProblemPrintHost from './components/print/ProblemPrintHost.vue'

const route = useRoute()
const showStudyNavigation = computed(() => Boolean(route.meta.studyNavigation))
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
