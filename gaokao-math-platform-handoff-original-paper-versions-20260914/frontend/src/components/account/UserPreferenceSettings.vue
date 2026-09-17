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
          <h2>浏览与显示</h2>
        </div>
        <span>统一管理题库、题目详情和题单的默认阅读方式。</span>
      </header>

      <section class="account-preference-section" aria-labelledby="problem-view-mode-title">
        <header>
          <h3 id="problem-view-mode-title">题库默认视图</h3>
          <p>进入题库时优先使用的题目浏览方式。</p>
        </header>
        <div class="account-preference-control">
          <div
            class="account-preference-options is-compact-choice"
            role="group"
            aria-labelledby="problem-view-mode-title"
          >
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
        </div>
      </section>

      <section class="account-preference-section" aria-labelledby="problem-display-title">
        <header>
          <h3 id="problem-display-title">题目卡片内容</h3>
          <p>选择题库卡片中默认展示的辅助信息。</p>
        </header>
        <div class="account-preference-control">
          <div
            class="account-preference-options is-checklist"
            role="group"
            aria-labelledby="problem-display-title"
          >
            <label v-for="option in PROBLEMS_DISPLAY_OPTION_OPTIONS" :key="option.value">
              <input
                type="checkbox"
                :checked="displayOptions[option.value]"
                @change="setDisplayOption(option.value, $event.target.checked)"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
          <div class="account-preference-section-actions" aria-label="题目卡片内容快捷操作">
            <button type="button" @click="setAllDisplayOptions(false)">全部隐藏</button>
            <button type="button" @click="setAllDisplayOptions(true)">全部显示</button>
          </div>
        </div>
      </section>

      <section class="account-preference-section" aria-labelledby="answer-placement-title">
        <header>
          <h3 id="answer-placement-title">答案解析位置</h3>
          <p>决定题目详情页中答案和解析出现的位置。</p>
        </header>
        <div class="account-preference-control">
          <div
            class="account-preference-options is-compact-choice"
            role="group"
            aria-labelledby="answer-placement-title"
          >
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
        </div>
      </section>

      <section class="account-preference-section" aria-labelledby="question-type-color-title">
        <header>
          <h3 id="question-type-color-title">题型颜色</h3>
          <p>使用颜色区分题型，或统一采用黑色显示。</p>
        </header>
        <div class="account-preference-control">
          <div
            class="account-preference-options is-compact-choice"
            role="group"
            aria-labelledby="question-type-color-title"
          >
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
        </div>
      </section>

      <section class="account-preference-section" aria-labelledby="practice-list-view-title">
        <header>
          <h3 id="practice-list-view-title">题单默认视图</h3>
          <p>打开题单时优先使用的题目排列方式。</p>
        </header>
        <div class="account-preference-control">
          <div
            class="account-preference-options is-compact-choice"
            role="group"
            aria-labelledby="practice-list-view-title"
          >
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
        </div>
      </section>
    </section>

    <section
      class="account-settings-card account-preference-card account-preference-tool-card account-print-settings-card"
    >
      <header class="account-settings-card-header">
        <div>
          <h2>打印与导出</h2>
        </div>
        <span>设置打印内容和纸张布局；答案与解析只影响题目详情。</span>
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
    </section>

    <section
      class="account-settings-card account-preference-card account-preference-tool-card account-action-settings-card"
    >
      <header class="account-settings-card-header">
        <div>
          <h2>操作确认</h2>
        </div>
        <span>选择哪些状态变更需要再次确认，减少误操作。</span>
      </header>
      <ProblemActionConfirmationSettings
        :confirmations="actionConfirmations"
        @change="setActionConfirmation($event.name, $event.enabled)"
      />
    </section>
  </div>
</template>
