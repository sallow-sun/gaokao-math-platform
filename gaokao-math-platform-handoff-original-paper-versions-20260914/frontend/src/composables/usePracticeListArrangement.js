const LEADING_SOURCE_NUMBER_PATTERN =
  /^\s*(?:[0-9０-９]{1,3}\s*[、．]\s*|[0-9０-９]{1,3}\s*\.\s*(?=[^0-9０-９\s]))/

export function stripPracticeListSourceNumber(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(LEADING_SOURCE_NUMBER_PATTERN, '')
    .trimStart()
}

export function formatPracticeListProblemContent(value, position) {
  const normalizedPosition = Number.isInteger(position) && position > 0 ? position : 1
  const content = stripPracticeListSourceNumber(value)

  return `${normalizedPosition}.${content ? ` ${content}` : ''}`
}

export function parsePracticeListProblemIds(value, problems = []) {
  const availableProblemIds = new Map(
    problems
      .map((problem) => String(problem?.id ?? '').trim())
      .filter(Boolean)
      .map((problemId) => [problemId.toUpperCase(), problemId]),
  )
  const seenProblemIds = new Set()
  const requestedProblemIds = String(value ?? '')
    .split(/[\s,，;；]+/)
    .map((problemId) => problemId.trim())
    .filter((problemId) => {
      const normalizedProblemId = problemId.toUpperCase()

      if (!normalizedProblemId || seenProblemIds.has(normalizedProblemId)) {
        return false
      }

      seenProblemIds.add(normalizedProblemId)
      return true
    })

  const validProblemIds = []
  const unknownProblemIds = []

  requestedProblemIds.forEach((problemId) => {
    const availableProblemId = availableProblemIds.get(problemId.toUpperCase())

    if (availableProblemId) {
      validProblemIds.push(availableProblemId)
    } else {
      unknownProblemIds.push(problemId)
    }
  })

  return {
    requestedProblemIds,
    unknownProblemIds,
    validProblemIds,
  }
}

export function getPracticeListDropIndex(fromIndex, targetIndex, position, itemCount) {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(targetIndex) ||
    itemCount < 2 ||
    fromIndex < 0 ||
    targetIndex < 0 ||
    fromIndex >= itemCount ||
    targetIndex >= itemCount ||
    fromIndex === targetIndex ||
    !['before', 'after'].includes(position)
  ) {
    return fromIndex
  }

  const rawDropIndex = position === 'before' ? targetIndex : targetIndex + 1
  const adjustedDropIndex = fromIndex < rawDropIndex ? rawDropIndex - 1 : rawDropIndex

  return Math.max(0, Math.min(adjustedDropIndex, itemCount - 1))
}
