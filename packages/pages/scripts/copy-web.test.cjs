const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {copyWebExport} = require('./copy-web.cjs')

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'greenlight web build '))
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
    const source = path.join(root,'web-out'), destination = path.join(root,'public')
    fs.mkdirSync(path.join(source,'home'),{recursive:true})
    fs.mkdirSync(destination)
    fs.writeFileSync(path.join(destination,'obsolete.txt'),'old')
    return {source,destination}
}
test('copy generated assets, including paths with spaces, without stale files',t=>{
    const {source,destination}=fixture(t)
    fs.writeFileSync(path.join(source,'home','index.html'),'new')
    fs.mkdirSync(path.join(source,'_next'),{recursive:true})
    fs.writeFileSync(path.join(source,'_next','bundle.js'),'bundle')
    copyWebExport(source,destination)
    assert.equal(fs.readFileSync(path.join(destination,'home','index.html'),'utf8'),'new')
    assert.equal(fs.readFileSync(path.join(destination,'_next','bundle.js'),'utf8'),'bundle')
    assert.equal(fs.existsSync(path.join(destination,'obsolete.txt')),false)
})
test('missing export must not delete the existing generated directory',t=>{
    const {source,destination}=fixture(t)
    assert.throws(()=>copyWebExport(source,destination),/Missing V3 web export/)
    assert.equal(fs.readFileSync(path.join(destination,'obsolete.txt'),'utf8'),'old')
})
test('refuse to replace a symlinked asset directory',t=>{
    const {source,destination}=fixture(t)
    const link=path.join(path.dirname(destination),'linked-public')
    fs.writeFileSync(path.join(source,'home','index.html'),'new')
    fs.symlinkSync(destination,link,'junction')
    assert.throws(()=>copyWebExport(source,link),/symlinked asset directory/)
    assert.equal(fs.readFileSync(path.join(destination,'obsolete.txt'),'utf8'),'old')
})
