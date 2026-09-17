<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiRequest } from '../../services/apiClient.js'
const props = defineProps({ userId: { type: String, required: true } })
const emit = defineEmits(['level'])
const data = ref(null),
  busy = ref(false),
  error = ref(''),
  expanded = ref(false),
  announcement = ref('')
const summary = computed(() => data.value?.summary),
  rules = computed(() => summary.value?.rules)
const progress = computed(() =>
  !summary.value
    ? 0
    : summary.value.nextThreshold == null
      ? 100
      : Math.min(
          100,
          ((summary.value.experience - summary.value.levelStart) /
            (summary.value.nextThreshold - summary.value.levelStart)) *
            100,
        ),
)
async function load(page = 1) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    data.value = await apiRequest('/api/v1/users/me/growth?page=' + page)
    emit('level', summary.value.level)
    try {
      const key = 'mathsea:last-level:' + props.userId,
        previous = localStorage.getItem(key)
      if (previous !== null && summary.value.level > Number(previous))
        announcement.value = `升级啦！现在是 Lv.${summary.value.level}`
      localStorage.setItem(key, String(summary.value.level))
    } catch {
      /* optional upgrade hint */
    }
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(() => load())
</script>
<template>
  <section class="growth-panel" aria-label="等级成长">
    <p v-if="error" role="alert">{{ error }} <button @click="load()">重试</button></p>
    <p v-if="announcement" role="status" class="growth-announcement">{{ announcement }}</p>
    <template v-if="summary"
      ><header>
        <div class="growth-level">Lv.{{ summary.level }}</div>
        <div class="growth-progress">
          <h2>等级成长 <small>测试版</small></h2>
          <p>
            {{ summary.experience }} 经验
            <span>{{
              summary.nextThreshold == null
                ? '已达到当前最高等级'
                : `距 Lv.${summary.level + 1} 还差 ${summary.remaining} 经验`
            }}</span>
          </p>
          <div
            role="progressbar"
            aria-label="升级进度"
            :aria-valuenow="Math.round(progress)"
            aria-valuemin="0"
            aria-valuemax="100"
            class="growth-track"
          >
            <i :style="{ width: progress + '%' }" />
          </div>
        </div>
        <button :aria-expanded="expanded" @click="expanded = !expanded">
          {{ expanded ? '收起明细' : '经验明细' }}
        </button>
      </header>
      <p class="growth-intro">等级记录学习与社区积累，不代表数学成绩。经验不因不活跃而减少。</p>
      <details>
        <summary>如何获得经验？</summary>
        <ul>
          <li>每日首次标记新题已做：额外 {{ rules.dailyStudy }} 经验。</li>
          <li>
            首次标记每道新题已做：{{ rules.firstProblem }} 经验，每日最多
            {{ rules.problemDailyCap }} 经验。
          </li>
          <li>
            社区投稿通过他人审核：{{ rules.acceptedUpload }} 经验，每日最多
            {{ rules.uploadDailyCap }} 经验。
          </li>
          <li>
            题目纠错被他人采纳：{{ rules.acceptedFeedback }} 经验，每日最多
            {{ rules.feedbackDailyCap }} 经验。
          </li>
        </ul>
        <p>
          同一道题的已做标记、相同内容投稿、同一题目的纠错均不重复计分。超过当日额度的事件不再补发。收藏、浏览、登录和发布试卷暂不奖励经验。
        </p>
        <p>
          经验从本功能上线后开始记录，历史已做和贡献不补发。规则仍处于测试阶段；违规经验可由负责人撤回，原因会出现在明细中。
        </p>
        <div class="growth-thresholds">
          <span v-for="(threshold, index) in rules.thresholds" :key="index"
            >Lv.{{ index }} · {{ threshold }} 经验</span
          >
        </div>
      </details>
      <section v-if="expanded" class="growth-history" aria-label="经验明细">
        <div class="growth-history-heading">
          <h3>经验明细</h3>
          <button :disabled="busy" @click="load()">刷新</button>
        </div>
        <p v-if="!data.items.length">还没有经验记录，完成一道新题或参与社区贡献即可开始积累。</p>
        <article v-for="entry in data.items" :key="entry.id">
          <div>
            <strong>{{ entry.description }}</strong
            ><small
              >{{ new Date(entry.created_at).toLocaleString('zh-CN') }} ·
              {{ entry.rule_version }}</small
            >
          </div>
          <span :class="{ 'is-reversed': entry.points < 0 }"
            >{{ entry.points > 0 ? '+' : '' }}{{ entry.points }}</span
          >
        </article>
        <nav v-if="data.total" aria-label="经验记录分页">
          <button :disabled="busy || data.page <= 1" @click="load(data.page - 1)">上一页</button
          ><span>{{ data.page }} / {{ Math.ceil(data.total / 20) }}</span
          ><button :disabled="busy || data.page * 20 >= data.total" @click="load(data.page + 1)">
            下一页
          </button>
        </nav>
      </section></template
    >
    <p v-else-if="!error" role="status">正在加载成长记录…</p>
  </section>
</template>
<style scoped>
.growth-panel {
  margin: 24px 0;
  padding: 24px;
  border: 1px solid #cbd6e0;
  border-radius: 6px;
  background: #fff;
  color: #365a78;
}
.growth-panel header {
  display: flex;
  align-items: center;
  gap: 24px;
}
.growth-level {
  padding: 15px 18px;
  border: 1px solid #b8ccdc;
  border-radius: 8px;
  background: #edf4fa;
  color: #205b87;
  font-size: 24px;
  font-weight: 700;
  white-space: nowrap;
}
.growth-progress {
  flex: 1;
  min-width: 0;
}
.growth-panel h2 {
  font-size: 18px;
  margin: 0;
}
.growth-panel h2 small {
  font-size: 10px;
  font-weight: normal;
  padding: 3px 6px;
  background: #f5f0e4;
  color: #917847;
  margin-left: 8px;
  border-radius: 3px;
}
.growth-progress p {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
}
.growth-progress p span {
  color: #7890a0;
  font-size: 12px;
}
.growth-track {
  height: 7px;
  border-radius: 9px;
  background: #e9eff4;
  overflow: hidden;
}
.growth-track i {
  display: block;
  height: 100%;
  background: #4b7da2;
  border-radius: 9px;
}
.growth-panel button {
  font: inherit;
  font-size: 12px;
  padding: 8px 12px;
  border: 1px solid #cbd6e0;
  border-radius: 4px;
  background: white;
  color: #205b87;
  cursor: pointer;
}
.growth-panel button:disabled {
  opacity: 0.5;
  cursor: default;
}
.growth-intro {
  font-size: 12px;
  color: #7c90a0;
  margin: 20px 0 12px;
}
.growth-panel details {
  font-size: 12px;
  line-height: 1.9;
  color: #758b9b;
}
.growth-panel summary {
  cursor: pointer;
  color: #365a78;
}
.growth-panel li {
  margin: 4px 0;
}
.growth-thresholds {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.growth-thresholds span {
  background: #f2f6f9;
  padding: 3px 7px;
  border-radius: 4px;
}
.growth-history {
  margin-top: 20px;
  border-top: 1px solid #e0e8ef;
  padding-top: 15px;
}
.growth-history-heading,
.growth-history article,
.growth-history nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.growth-history h3 {
  font-size: 15px;
  margin: 0;
}
.growth-history article {
  border-bottom: 1px solid #edf1f4;
  padding: 14px 0;
  font-size: 13px;
}
.growth-history article strong {
  font-weight: 500;
  overflow-wrap: anywhere;
}
.growth-history small {
  display: block;
  font-size: 11px;
  color: #8b9eac;
  margin-top: 6px;
}
.growth-history article > span {
  font-weight: bold;
  color: #367066;
}
.growth-history article > span.is-reversed {
  color: #a55243;
}
.growth-history nav {
  justify-content: center;
  margin-top: 15px;
  font-size: 12px;
}
.growth-history > p {
  font-size: 13px;
  color: #7c90a0;
}
.growth-announcement {
  padding: 10px;
  background: #edf5f0;
  font-size: 14px;
  border-radius: 5px;
}
@media (max-width: 600px) {
  .growth-panel {
    padding: 16px;
  }
  .growth-panel header {
    gap: 12px;
    flex-wrap: wrap;
  }
  .growth-level {
    font-size: 20px;
    padding: 12px;
  }
  .growth-panel header > button {
    margin-left: auto;
  }
  .growth-progress {
    min-width: 160px;
  }
}
</style>
