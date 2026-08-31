<script setup>
import { ref } from 'vue'

defineProps({
  problemsRoute: {
    type: [String, Object],
    required: true,
  },
  trainingRoute: {
    type: [String, Object],
    required: true,
  },
})

const emit = defineEmits(['search', 'random-problem'])
const keyword = ref('')

function submitSearch() {
  const normalizedKeyword = keyword.value.trim()
  if (normalizedKeyword) {
    emit('search', normalizedKeyword)
  }
}
</script>

<template>
  <section class="home-search-panel" aria-labelledby="home-logo">
    <h1 id="home-logo" class="home-logo">mathverse</h1>

    <form class="home-search-form" role="search" @submit.prevent="submitSearch">
      <label class="visually-hidden" for="home-search-input">搜索题目、知识点或试卷</label>
      <span class="home-search-icon" aria-hidden="true"></span>
      <input
        id="home-search-input"
        v-model="keyword"
        class="home-search-input"
        type="search"
        name="keyword"
        placeholder="搜索题目、知识点或试卷"
        autocomplete="off"
        enterkeyhint="search"
        required
        autofocus
      />
      <button class="visually-hidden" type="submit">搜索</button>
    </form>

    <div class="home-search-actions" role="group" aria-label="首页快捷入口">
      <RouterLink class="home-text-button" :to="problemsRoute">题库</RouterLink>
      <RouterLink class="home-text-button" :to="trainingRoute">题单</RouterLink>
      <button class="home-text-button" type="button" @click="emit('random-problem')">
        随机跳题
      </button>
    </div>
  </section>
</template>
