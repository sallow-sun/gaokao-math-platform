const fs = require('node:fs')
const path = require('node:path')
fs.mkdirSync(path.resolve(__dirname, '../../.tmp'), { recursive: true })
// An explicitly supplied browser takes priority; otherwise use Playwright Chromium.
exports.browserExecutable = process.env.CHROME_EXECUTABLE || undefined
exports.getTestPort = () => new Promise((resolve, reject) => {
  const server = require('node:net').createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    server.close(error => error ? reject(error) : resolve(port))
  })
})
