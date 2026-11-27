const { spawnSync } = require('node:child_process')
const path = require('node:path')
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
    cwd: path.resolve(__dirname, '../renderer'),
    env: {...process.env, BUILD_TARGET: 'web'},
    stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
