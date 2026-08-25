<script setup>
import { useRouter } from "vue-router";
import HomeFooter from "../components/home/HomeFooter.vue";
import HomeModeToggle from "../components/home/HomeModeToggle.vue";
import HomeSearchPanel from "../components/home/HomeSearchPanel.vue";
import { useHomePreferences } from "../composables/useHomePreferences";
import { HOME_ROUTES, RANDOM_PROBLEM_IDS } from "../config/home";
import "../assets/styles/home.css";

const router = useRouter();
const {
  theme,
  isDark,
  hasBackground,
  backgroundStyle,
  statusMessage,
  announce,
  toggleTheme,
  applyBackground,
  pickRandomProblem,
} = useHomePreferences();

async function navigateTo(route, onError) {
  try {
    await router.push(route);
  } catch {
    announce("页面暂时无法打开，请检查首页路由配置");
    onError?.();
  }
}

function goToNormalHome(resetToggle) {
  navigateTo(HOME_ROUTES.normalHome, resetToggle);
}

function searchProblems(keyword) {
  navigateTo({
    path: HOME_ROUTES.problems,
    query: { keyword },
  });
}

function goToRandomProblem() {
  const problemId = pickRandomProblem(RANDOM_PROBLEM_IDS);

  if (!problemId) {
    navigateTo(HOME_ROUTES.problems);
    return;
  }

  navigateTo(HOME_ROUTES.question(problemId));
}
</script>

<template>
  <div
    class="home-page"
    :class="{ 'has-background': hasBackground }"
    :data-theme="theme"
    :style="backgroundStyle"
  >
    <HomeModeToggle @switch="goToNormalHome" />

    <main class="home-main">
      <HomeSearchPanel
        :problems-route="HOME_ROUTES.problems"
        @search="searchProblems"
        @random-problem="goToRandomProblem"
      />
    </main>

    <HomeFooter
      :about-route="HOME_ROUTES.about"
      :help-route="HOME_ROUTES.help"
      :is-dark="isDark"
      :status-message="statusMessage"
      @background-selected="applyBackground"
      @toggle-theme="toggleTheme"
    />
  </div>
</template>
