const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const noPack = args.includes('--no-pack')
const run = (command, params) => {
    const result = spawnSync(command, params, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status || 1)
}
run('nextron', ['build', '--no-pack'])
for (const file of ['app/main.js', 'app/preload.js']) {
    if (!fs.existsSync(path.join(root, file))) {
        console.error('Compilation failed: missing ' + file)
        process.exit(1)
    }
}
if (!noPack) run('electron-builder', args)
