import { computed, unref } from 'vue'

const LEVEL_ORDER = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'black', 'white']

function includesSelectedValue(selectedValues, value) {
  return selectedValues.length === 0 || selectedValues.includes(value)
}

function matchesKeyword(problem, keyword) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase('zh-CN')

  if (!normalizedKeyword) {
    return true
  }

  const searchableText = [
    problem.id,
    problem.title,
    problem.detail,
    problem.sourceLabel,
    problem.typeLabel,
    problem.content,
    ...problem.tags,
  ]
    .join(' ')
    .toLocaleLowerCase('zh-CN')

  return searchableText.includes(normalizedKeyword)
}

function compareProblems(firstProblem, secondProblem, sort) {
  if (sort === 'oldest') {
    return Number(firstProblem.year) - Number(secondProblem.year)
  }

  if (sort === 'easy-first' || sort === 'hard-first') {
    const direction = sort === 'easy-first' ? 1 : -1
    const firstLevel = LEVEL_ORDER.indexOf(firstProblem.level)
    const secondLevel = LEVEL_ORDER.indexOf(secondProblem.level)
    const levelDifference = (firstLevel - secondLevel) * direction

    if (levelDifference !== 0) {
      return levelDifference
    }
  } else {
    const yearDifference = Number(secondProblem.year) - Number(firstProblem.year)

    if (yearDifference !== 0) {
      return yearDifference
    }
  }

  return firstProblem.id.localeCompare(secondProblem.id, 'zh-CN')
}

export function filterAndSortPrototypeProblems(problems, filters) {
  return problems
    .filter(
      (problem) =>
        includesSelectedValue(filters.years, problem.year) &&
        includesSelectedValue(filters.sources, problem.source) &&
        includesSelectedValue(filters.types, problem.type) &&
        includesSelectedValue(filters.levels, problem.level) &&
        matchesKeyword(problem, filters.keyword),
    )
    .sort((firstProblem, secondProblem) =>
      compareProblems(firstProblem, secondProblem, filters.sort),
    )
}

export function usePrototypeProblems({
  keyword,
  levels,
  problems,
  questionTypes,
  sort,
  sources,
  years,
}) {
  return computed(() =>
    filterAndSortPrototypeProblems(problems, {
      keyword: unref(keyword),
      levels: unref(levels),
      sources: unref(sources),
      sort: unref(sort),
      types: unref(questionTypes),
      years: unref(years),
    }),
  )
}
