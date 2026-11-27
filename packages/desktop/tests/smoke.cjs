const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const https = require('node:https')
const os = require('node:os')
const path = require('node:path')
const { Writable } = require('node:stream')

const variant = process.argv[2] ?? 'v2'
assert.ok(variant === 'v2' || variant === 'v3', 'Choose v2 or v3')
const workspace = path.resolve(__dirname, variant === 'v3' ? '../../desktop-v3' : '..')
const entry = path.join(workspace, 'app', 'main.js')

if (process.versions.electron) {
    const { app, session } = require('electron')
    app.setAppPath(workspace)
    app.setPath('userData', process.argv[3])
    app.setPath('sessionData', process.argv[3])
    const heading = variant === 'v2' ? require('../renderer/languages/en-US.json').translation.auth.loginWithXbox : ''

    // V2 requests a device code on a fresh profile. Keep the request pending
    // during this boot check so it never opens a real sign-in prompt.
    const request = https.request
    https.request = function (options, ...args) {
        if (options?.hostname === 'login.microsoftonline.com' && options.path === '/consumers/oauth2/v2.0/devicecode') {
            return new Writable({ write(_chunk, _encoding, done) { done() } })
        }
        return request.call(this, options, ...args)
    }
    app.once('ready', () => {
        session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, done) => done({ cancel: true }))
    })

    const fail = error => {
        console.error(`[${variant} smoke] ${error}`)
        app.exit(1)
    }
    let passed = false
    app.on('before-quit', event => {
        if (passed) return
        event.preventDefault()
        fail('Application closed before the startup check finished')
    })
    app.once('browser-window-created', (_event, window) => {
        const contents = window.webContents
        contents.once('render-process-gone', (_event, { reason }) => fail(`Renderer exited: ${reason}`))
        contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
            if (isMainFrame) fail(`Renderer load failed (${code}): ${description}`)
        })
        contents.once('did-finish-load', async () => {
            try {
                assert.equal(new URL(contents.getURL()).protocol, 'app:')
                await contents.executeJavaScript(`(${checkRenderer})(${JSON.stringify(variant)}, ${JSON.stringify(heading)})`)
                passed = true
                console.log(`[${variant} smoke] Sign-in screen and Electron IPC passed`)
                app.quit()
            } catch (error) {
                fail(error.message)
            }
        })
    })
    try {
        require(entry)
    } catch (error) {
        fail(error.stack)
    }
} else {
    assert.ok(fs.existsSync(entry), `Missing ${entry}. Run a desktop build first.`)
    const electron = require(require.resolve('electron', { paths: [workspace] }))
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'greenlight-smoke-'))
    const env = { ...process.env, NODE_ENV: 'production', DEBUG: process.env.DEBUG ?? 'greenlight:electron' }
    delete env.CI
    delete env.ELECTRON_RUN_AS_NODE

    try {
        const run = spawnSync(electron, [__filename, variant, profile, `--user-data-dir=${profile}`], {
            cwd: workspace, env, stdio: 'inherit', timeout: 30000,
        })
        if (run.error) throw run.error
        process.exitCode = run.status ?? 1
    } finally {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
}

async function checkRenderer(version, heading) {
    function signInVisible() {
        const signIn = version === 'v2'
            ? document.querySelector('#component_auth button')
            : Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Sign in with Microsoft')
        return Boolean(signIn?.getClientRects().length)
    }

    const deadline = performance.now() + 10000
    while (!signInVisible()) {
        if (performance.now() >= deadline) throw Error('Sign-in screen did not appear')
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (!document.title.includes('Greenlight')) throw Error('Unexpected window title')

    if (version === 'v2') {
        const html = await fetch(location.href).then(response => response.text())
        const initialDocument = new DOMParser().parseFromString(html, 'text/html')
        if (initialDocument.querySelector('#component_auth h1')?.textContent !== heading) {
            throw Error('Expected translated sign-in heading in the initial HTML')
        }
        const state = await window.Greenlight.send('app', 'getAuthState')
        if (state.isAuthenticated !== false) throw Error('Expected an isolated signed-out profile')
    } else {
        const response = await window.trpcIpc.invoke({ path: 'ping', type: 'query' })
        if (response.result?.data !== 'pong') throw Error('Expected a pong from the V3 backend')
    }
}
