const { spawnSync } = require('node:child_process')
const path = require('node:path')
const result = spawnSync('nextron', [], {
    cwd: path.resolve(__dirname, '..'),
    env: {...process.env, DEBUG: process.env.DEBUG || 'greenlight:*'},
    stdio: 'inherit',
    shell: process.platform === 'win32',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
