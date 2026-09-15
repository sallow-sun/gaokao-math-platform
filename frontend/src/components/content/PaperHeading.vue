<script setup>
defineProps({
  title: String,
  pageCount: Number,
  questionCount: Number,
  totalScore: Number,
})
</script>

<template>
  <header class="paper-heading">
    <p>{{ title || '数学练习卷' }}</p>
    <h2>数　学</h2>
    <div class="paper-instructions">
      本试卷共 {{ pageCount }} 页，{{ questionCount }} 小题，满分 {{ totalScore }} 分。
    </div>
    <div class="paper-notices">
      <strong>注意事项：</strong>
      <ol>
        <li>答题前，请在答题纸上填写姓名等信息。</li>
        <li>请认真审题，规范作答；解答题应写出文字说明、证明过程或演算步骤。</li>
      </ol>
    </div>
  </header>
</template>
