<script setup>
import { computed, ref } from 'vue'

// 普通常量：总题数暂时不变
const totalQuestions = 20

// 响应式数据：值改变后，页面会自动更新
const studentName = ref('')
const completedCount = ref(0)

// 计算属性：根据其他数据自动计算
const remainingCount = computed(() => {
  return totalQuestions - completedCount.value
})

// 普通 JavaScript 函数
function completeOne() {
  if (completedCount.value < totalQuestions) {
    completedCount.value++
  }
}

function deleteOne() {
  if(completedCount.value > 0){
    completedCount.value--
  }
}

function resetProgress() {
  completedCount.value = 0
}
</script>

<template>
  <main class="practice-page">
    <h1>高考数学题库</h1>

    <label>
      你的名字：
      <input v-model="studentName" placeholder="请输入名字" />
    </label>

    <p v-if="studentName">
      你好，{{ studentName }}！
    </p>

    <section class="progress-card">
      <p>题目总数：{{ totalQuestions }}</p>
      <p>已经完成：{{ completedCount }}</p>
      <p>剩余题目：{{ remainingCount }}</p>

      <button
        :disabled="completedCount >= totalQuestions"
        @click="completeOne"
      >
        我做完了一道题
      </button>

      <button
        :disabled="completedCount <= 0"
        @click="deleteOne"
      >
        减少一道
      </button>

      <button @click="resetProgress">
        重置进度
      </button>

      <p v-if="completedCount === totalQuestions">
        恭喜，全部完成！
      </p>
    </section>
  </main>
</template>

<style scoped>
.practice-page {
  max-width: 600px;
  margin: 40px auto;
  padding: 24px;
}

.practice-page h1 {
  margin-bottom: 24px;
}

.practice-page input {
  margin-left: 8px;
  padding: 8px 12px;
}

.progress-card {
  margin-top: 24px;
  padding: 20px;
  border: 1px solid #dddddd;
  border-radius: 12px;
}

.progress-card button {
  margin-right: 12px;
  padding: 8px 16px;
}
</style>