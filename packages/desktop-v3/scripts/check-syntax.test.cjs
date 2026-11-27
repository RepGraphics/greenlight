const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const {sourceFiles,syntaxDiagnostics}=require('./check-syntax.cjs')
test('syntax gate catches JSX parse errors without requiring dependency builds',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'greenlight-syntax-'))
    try{
        const good=path.join(root,'valid.tsx'),bad=path.join(root,'invalid.tsx')
        fs.writeFileSync(good,'export const Component=()=> <div>{true && <span/>}</div>')
        fs.writeFileSync(bad,'export const Component=()=> <div>{true && <span/></div>')
        assert.equal(syntaxDiagnostics([good]).length,0)
        assert.ok(syntaxDiagnostics([bad]).length>0)
    }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('syntax gate scans source only and skips generated directories and non-source files',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'greenlight-syntax-'))
    try{
        for(const name of ['renderer','.next','node_modules','dist','web-out']){
            fs.mkdirSync(path.join(root,name))
            fs.writeFileSync(path.join(root,name,'sample.tsx'),'')
        }
        fs.writeFileSync(path.join(root,'notes.md'),'')
        fs.writeFileSync(path.join(root,'index.mts'),'')
        assert.deepEqual(sourceFiles(root).sort(),[path.join(root,'index.mts'),path.join(root,'renderer','sample.tsx')].sort())
    }finally{fs.rmSync(root,{recursive:true,force:true})}
})
