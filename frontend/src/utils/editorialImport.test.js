import test from 'node:test'
import assert from 'node:assert/strict'
import { imageReferences, prepareImport } from './editorialImport.js'

function file(path, text = '') {
  const value = new File([text], path.split('/').at(-1))
  Object.defineProperty(value, 'webkitRelativePath', { value: path })
  return value
}
test('same filenames in different papers never cross-associate images', async () => {
  const a = file('2000/文科/T1.png'),
    b = file('2000/理科/T1.png')
  const plan = await prepareImport([
    file('2000/文科/T1.md', 'img：{T1.png}'),
    file('2000/理科/T1.md', 'Img:{T1.png}'),
    a,
    b,
  ])
  assert.equal(plan.groups.length, 2)
  for (const entry of plan.entries)
    assert.equal(entry.images[0].file.webkitRelativePath, `${entry.folder}/T1.png`)
})
test('missing, ambiguous and remote image references produce actionable warnings', async () => {
  const plan = await prepareImport([
    file('T1.md', 'img：{missing.png}\n![](https://example.test/a.png)'),
    file('x.png'),
    file('x.png'),
  ])
  assert.equal(plan.entries[0].warnings.length, 2)
  assert.equal(plan.entries[0].images.length, 0)
})
test('rule 1.2 image values and Markdown references coexist without duplicates', () => {
  assert.deepEqual(imageReferences('img：0\nImg:{图.png}{图2.png}\n![](图.png)'), [
    '图.png',
    '图2.png',
  ])
})
