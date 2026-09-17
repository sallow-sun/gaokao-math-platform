<script setup>
defineProps({
  totalCount: {
    type: [Number, String],
    default: '—',
  },
  yearCount: {
    type: [Number, String],
    default: '—',
  },
  topicCount: {
    type: [Number, String],
    default: '—',
  },
})
</script>

<template>
  <section class="bank-header" aria-labelledby="bank-page-title">
    <div class="bank-header-content">
      <div class="bank-header-title">
        <h1 id="bank-page-title">高考数学题库</h1>
        <p>长风破浪会有时，直挂云帆济沧海。</p>
      </div>

      <dl class="bank-header-stats" aria-label="题库概况">
        <div>
          <dt>已收录</dt>
          <dd>{{ totalCount }}</dd>
        </div>
        <div>
          <dt>真题年份</dt>
          <dd>{{ yearCount }}</dd>
        </div>
        <div>
          <dt>知识专题</dt>
          <dd>{{ topicCount }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
