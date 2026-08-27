<script setup>
import ProblemActionConfirmationSettings from '../personalization/ProblemActionConfirmationSettings.vue'
import ProblemPrintSettings from '../personalization/ProblemPrintSettings.vue'
import { PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS } from '../../composables/useProblemPrintPreferences.js'
import {
  QUESTION_ANSWER_PLACEMENT_OPTIONS,
  QUESTION_PRINT_OPTION_OPTIONS,
  QUESTION_TYPE_COLOR_OPTIONS,
  useQuestionPreferences,
} from '../../composables/useQuestionPreferences.js'
import { usePracticeListOutputPreferences } from '../../composables/usePracticeListOutputPreferences.js'
import { usePracticeListViewPreferences } from '../../composables/usePracticeListViewPreferences.js'
import { useProblemsActionPreferences } from '../../composables/useProblemsActionPreferences.js'
import { useProblemsDisplayPreferences } from '../../composables/useProblemsDisplayPreferences.js'
import { PROBLEMS_DISPLAY_OPTION_OPTIONS } from '../../config/problems.js'

const PROBLEMS_VIEW_MODE_OPTIONS = [
  { value: 'preview-view', label: '卡片预览' },
  { value: 'list-view', label: '简略列表' },
]

const PRACTICE_LIST_VIEW_MODE_OPTIONS = [
  { value: 'list-view', label: '列表视图' },
  { value: 'preview-view', label: '卡片预览' },
]

const { actionConfirmations, setActionConfirmation } = useProblemsActionPreferences()
const { displayOptions, setAllDisplayOptions, setDisplayOption, setViewMode, viewMode } =
  useProblemsDisplayPreferences()
const {
  answerPlacement,
  includePrintHeader,
  printOptions,
  printPageLayout,
  setAnswerPlacement,
  setIncludePrintHeader,
  setPrintOption,
  setPrintPageLayout,
  setPrintPreset,
  setTypeColorMode,
  typeColorMode,
} = useQuestionPreferences()
const { includeNotes, setIncludeNotes } = usePracticeListOutputPreferences()
const { setViewMode: setPracticeListViewMode, viewMode: practiceListViewMode } =
  usePracticeListViewPreferences()
</script>

<template>
  <div class="account-preference-list">
    <section class="account-settings-card account-preference-card">
      <header class="account-settings-card-header">
        <div>
          <p>LOCAL PREFERENCES</p>
          <h2>题库显示</h2>
        </div>
        <span>调整题库默认视图和题目卡片中显示的内容。</span>
      </header>

      <section class="account-preference-section" aria-labelledby="problem-view-mode-title">
        <header>
          <h3 id="problem-view-mode-title">默认视图</h3>
        </header>
        <div class="account-preference-options">
          <label v-for="option in PROBLEMS_VIEW_MODE_OPTIONS" :key="option.value">
            <input
              type="radio"
              name="settings-problem-view-mode"
              :value="option.value"
              :checked="viewMode === option.value"
              @change="setViewMode(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </section>

      <section class="account-preference-section" aria-labelledby="problem-display-title">
        <header>
          <h3 id="problem-display-title">题目卡片内容</h3>
        </header>
        <div class="account-preference-options">
          <label v-for="option in PROBLEMS_DISPLAY_OPTION_OPTIONS" :key="option.value">
            <input
              type="checkbox"
              :checked="displayOptions[option.value]"
              @change="setDisplayOption(option.value, $event.target.checked)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
        <footer class="account-preference-section-actions">
          <button type="button" @click="setAllDisplayOptions(false)">全部隐藏</button>
          <button type="button" @click="setAllDisplayOptions(true)">全部显示</button>
        </footer>
      </section>
    </section>

    <section class="account-settings-card account-preference-card">
      <header class="account-settings-card-header">
        <div>
          <p>QUESTION PAGE</p>
          <h2>题目详情</h2>
        </div>
        <span>设置答案解析位置和题型颜色。</span>
      </header>

      <section class="account-preference-section" aria-labelledby="answer-placement-title">
        <header><h3 id="answer-placement-title">答案解析位置</h3></header>
        <div class="account-preference-options">
          <label v-for="option in QUESTION_ANSWER_PLACEMENT_OPTIONS" :key="option.value">
            <input
              type="radio"
              name="settings-answer-placement"
              :value="option.value"
              :checked="answerPlacement === option.value"
              @change="setAnswerPlacement(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </section>

      <section class="account-preference-section" aria-labelledby="question-type-color-title">
        <header><h3 id="question-type-color-title">题型颜色</h3></header>
        <div class="account-preference-options">
          <label v-for="option in QUESTION_TYPE_COLOR_OPTIONS" :key="option.value">
            <input
              type="radio"
              name="settings-question-type-color"
              :value="option.value"
              :checked="typeColorMode === option.value"
              @change="setTypeColorMode(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </section>
    </section>

    <section class="account-settings-card account-preference-card">
      <header class="account-settings-card-header">
        <div>
          <p>PRACTICE LIST</p>
          <h2>题单显示</h2>
        </div>
        <span>设置题单浏览方式；打印备注选项在下方统一设置。</span>
      </header>

      <section class="account-preference-section" aria-labelledby="practice-list-view-title">
        <header><h3 id="practice-list-view-title">默认视图</h3></header>
        <div class="account-preference-options">
          <label v-for="option in PRACTICE_LIST_VIEW_MODE_OPTIONS" :key="option.value">
            <input
              type="radio"
              name="settings-practice-list-view-mode"
              :value="option.value"
              :checked="practiceListViewMode === option.value"
              @change="setPracticeListViewMode(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </section>
    </section>

    <section class="account-settings-card account-preference-card account-shared-settings-card">
      <header class="account-settings-card-header">
        <div>
          <p>PRINT & ACTIONS</p>
          <h2>打印与操作确认</h2>
        </div>
        <span>公共打印项跨页面共享；答案和解析只影响题目详情。</span>
      </header>

      <ProblemPrintSettings
        :include-header="includePrintHeader"
        :include-notes="includeNotes"
        :options="printOptions"
        :option-options="QUESTION_PRINT_OPTION_OPTIONS"
        :page-layout="printPageLayout"
        :page-layout-options="PROBLEM_PRINT_PAGE_LAYOUT_OPTIONS"
        show-notes-option
        @include-header-change="setIncludePrintHeader"
        @include-notes-change="setIncludeNotes"
        @option-change="setPrintOption($event.name, $event.visible)"
        @page-layout-change="setPrintPageLayout"
        @preset-change="setPrintPreset"
      />

      <ProblemActionConfirmationSettings
        :confirmations="actionConfirmations"
        @change="setActionConfirmation($event.name, $event.enabled)"
      />
    </section>

    <p class="account-local-preference-note" role="status">
      上述修改会立即写入当前浏览器的本地存储，但不会同步到账号或其他设备。
    </p>
  </div>
</template>
