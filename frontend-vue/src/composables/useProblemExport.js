import { writeTextToClipboard } from './useClipboard.js'

export function createProblemExportData(problem) {
  return {
    content: String(problem.content ?? '').trim(),
    problemId: String(problem.id ?? 'problem'),
    source: String(problem.sourceText ?? '').trim(),
    title: String(problem.title ?? '题目').trim(),
    type: String(problem.typeLabel ?? '').trim(),
  }
}

export function getSafeProblemFileName(value) {
  return (
    String(value || '题目')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || '题目'
  )
}

export function getProblemPlainText(problem) {
  const data = createProblemExportData(problem)

  return [
    data.title,
    data.problemId ? `题号：${data.problemId}` : '',
    data.type ? `题型：${data.type}` : '',
    data.source ? `来源：${data.source}` : '',
    '',
    data.content,
  ]
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join('\n')
}

export function getProblemMarkdown(problem) {
  const data = createProblemExportData(problem)

  return [
    `## ${data.title}`,
    '',
    data.problemId ? `**题号：** ${data.problemId}` : '',
    data.type ? `**题型：** ${data.type}` : '',
    data.source ? `**来源：** ${data.source}` : '',
    '',
    data.content,
  ]
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join('\n')
}

export function escapeProblemLatex(value) {
  const replacements = {
    '\\': '\\textbackslash{}',
    '#': '\\#',
    $: '\\$',
    '%': '\\%',
    '&': '\\&',
    _: '\\_',
    '{': '\\{',
    '}': '\\}',
    '^': '\\textasciicircum{}',
    '~': '\\textasciitilde{}',
  }

  return String(value || '').replace(/[\\#$%&_{}^~]/g, (character) => replacements[character])
}

export function getProblemLatex(problem) {
  const data = createProblemExportData(problem)
  const body = data.content.split('\n').map(escapeProblemLatex).join('\\\\\n')

  return [
    `\\subsection*{${escapeProblemLatex(data.title)}}`,
    data.problemId ? `\\textbf{题号：${escapeProblemLatex(data.problemId)}}` : '',
    data.type ? `\\textbf{题型：${escapeProblemLatex(data.type)}}` : '',
    data.source ? `\\textbf{来源：${escapeProblemLatex(data.source)}}` : '',
    '',
    body,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function copyProblem(problem, format) {
  const formatters = {
    latex: getProblemLatex,
    markdown: getProblemMarkdown,
    text: getProblemPlainText,
  }
  const formatter = formatters[format]

  if (!formatter) {
    return Promise.reject(new Error('unsupported copy format'))
  }

  return writeTextToClipboard(formatter(problem))
}

function getCanvasLines(context, value, maxWidth) {
  const lines = []

  String(value || '')
    .split('\n')
    .forEach((paragraph) => {
      if (!paragraph) {
        lines.push('')
        return
      }

      let line = ''
      Array.from(paragraph).forEach((character) => {
        const nextLine = line + character

        if (line && context.measureText(nextLine).width > maxWidth) {
          lines.push(line)
          line = character
        } else {
          line = nextLine
        }
      })
      lines.push(line)
    })

  return lines
}

function downloadCanvas(canvas, fileName) {
  return new Promise((resolve, reject) => {
    function downloadBlob(blob) {
      if (!blob) {
        reject(new Error('image export failed'))
        return
      }

      const link = document.createElement('a')
      link.download = `${fileName}.png`
      link.href = URL.createObjectURL(blob)
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      resolve()
    }

    if (canvas.toBlob) {
      canvas.toBlob(downloadBlob, 'image/png')
      return
    }

    try {
      const link = document.createElement('a')
      link.download = `${fileName}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      resolve()
    } catch (error) {
      reject(error)
    }
  })
}

export function exportProblemAsImage(problem) {
  const data = createProblemExportData(problem)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    return Promise.reject(new Error('canvas unavailable'))
  }

  const width = 1400
  const horizontalPadding = 76
  const contentWidth = width - horizontalPadding * 2
  context.font = '26px "Noto Serif SC", "Songti SC", SimSun, serif'
  const bodyLines = getCanvasLines(context, data.content, contentWidth)
  const height = Math.max(520, 280 + bodyLines.length * 46 + 80)

  canvas.width = width
  canvas.height = height
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#d6dfe6'
  context.lineWidth = 2
  context.strokeRect(24, 24, width - 48, height - 48)

  context.fillStyle = '#092744'
  context.font = '700 36px "Noto Serif SC", "Songti SC", SimSun, serif'
  context.fillText(data.title, horizontalPadding, 105, contentWidth)

  context.fillStyle = '#526474'
  context.font = '20px "Noto Sans SC", "Microsoft YaHei", sans-serif'
  const meta = [data.problemId, data.type, data.source].filter(Boolean).join('  ·  ')
  context.fillText(meta, horizontalPadding, 153, contentWidth)

  context.strokeStyle = '#dce4ea'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(horizontalPadding, 188)
  context.lineTo(width - horizontalPadding, 188)
  context.stroke()

  context.fillStyle = '#172b3c'
  context.font = '26px "Noto Serif SC", "Songti SC", SimSun, serif'
  bodyLines.forEach((line, index) => {
    context.fillText(line, horizontalPadding, 245 + index * 46, contentWidth)
  })

  return downloadCanvas(canvas, getSafeProblemFileName(data.title))
}
