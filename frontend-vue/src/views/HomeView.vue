<script setup>
import { computed, ref } from 'vue'

const studentName = ref('')

// 数组中保存了三个题目对象
const questions = ref([
  {
    id: 1,
    title: '集合与常用逻辑用语',
    difficulty: '绿色',
    solved: true,
    source: '2026年全国Ⅰ卷',
  },
  {
    id: 2,
    title: '函数的单调性与最值',
    difficulty: '黄色',
    solved: false,
    source: '2026年全国Ⅰ卷',
  },
  {
    id: 3,
    title: '空间几何体的表面积',
    difficulty: '红色',
    solved: false,
    source: '2026年全国Ⅰ卷',
  },
  {
    id: 4,
    title: 'a',
    difficulty: '绿色',
    solved: false,
    source: '2026年全国Ⅰ卷',
  },
])

// 题目总数等于数组的长度
const totalQuestions = computed(() => {
  return questions.value.length
})

// 找出 solved 为 true 的题目，然后统计数量
const completedCount = computed(() => {
  return questions.value.filter((i) => {
    return i.solved
  }).length
})

const remainingCount = computed(() => {
  return totalQuestions.value - completedCount.value
})

// 把当前题目的完成状态反转
function toggleSolved(question) {
  question.solved = !question.solved
}

// 遍历所有题目，恢复成未完成状态
function resetProgress() {
  questions.value.forEach((i) => {
    i.solved = false
  })
}
</script>

<template>
  <main class="practice-page">
    <h1>高考数学题库</h1>

    <label class="name-field">
      你的名字：
      <input v-model="studentName" placeholder="请输入名字" />
    </label>

    <p v-if="studentName">你好，{{ studentName }}！</p>

    <section class="progress-card">
      <p>题目总数：{{ totalQuestions }}</p>
      <p>已经完成：{{ completedCount }}</p>
      <p>剩余题目：{{ remainingCount }}</p>

      <button :disabled="completedCount === 0" @click="resetProgress">重置进度</button>
    </section>

    <ul class="question-list">
      <li
        v-for="question in questions"
        :key="question.id"
        class="question-card"
        :class="{ solved: question.solved }"
      >
        <div>
          <p class="question-number">题目 {{ question.id }}</p>

          <h2>{{ question.title }}</h2>

          <p>难度：{{ question.difficulty }}</p>

          <p>来源:{{ question.source }}</p>
        </div>

        <button @click="toggleSolved(question)">
          {{ question.solved ? '标记为未完成' : '标记为已完成' }}
        </button>
      </li>
    </ul>

    <p v-if="completedCount === totalQuestions" class="complete-message">恭喜，全部完成！</p>
  </main>
</template>

<style scoped>
.practice-page {
  max-width: 720px;
  margin: 40px auto;
  padding: 24px;
}

.name-field input {
  margin-left: 8px;
  padding: 8px 12px;
}

.progress-card {
  margin: 24px 0;
  padding: 20px;
  border: 1px solid #dddddd;
  border-radius: 12px;
}

.progress-card button,
.question-card button {
  padding: 8px 16px;
}

.question-list {
  padding: 0;
  list-style: none;
}

.question-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
  padding: 20px;
  border: 1px solid #dddddd;
  border-radius: 12px;
}

.question-card.solved {
  background: #f0fff4;
  border-color: #70b782;
}

.question-card.solved h2 {
  color: #777777;
  text-decoration: line-through;
}

.question-number {
  color: #777777;
}

.complete-message {
  color: #27813e;
  font-weight: bold;
}
</style>
