// Display normalization only. Original Markdown remains unchanged for editing.
export function normalizeQuestionSpacing(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split('\n')
    .map(line => line.replace(/[ \t]+$/g, '')).filter(line => line.trim()).join('\n').trimEnd()
}
