import test from 'node:test'
import assert from 'node:assert/strict'
import { requestDeadline } from './requestDeadline.js'
test('deadline exits even when a request ignores cancellation', async () => {
  let signal
  await assert.rejects(
    requestDeadline((s) => {
      signal = s
      return new Promise(() => {})
    }, 15),
    /超时/,
  )
  assert.equal(signal.aborted, true)
})
test('cancelled prefetch exits without waiting on the network', async () => {
  const controller = new AbortController()
  const request = requestDeadline(() => new Promise(() => {}), 1000, controller.signal)
  controller.abort()
  await assert.rejects(request, /取消/)
  assert.equal(await requestDeadline(async () => 'next'), 'next')
})
