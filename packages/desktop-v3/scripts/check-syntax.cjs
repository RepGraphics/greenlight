const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const ignored=new Set(['node_modules','.next','app','web-out','dist','coverage','.git'])
function sourceFiles(directory){
    return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
        const filename=path.join(directory,entry.name)
        if(entry.isDirectory())return ignored.has(entry.name)?[]:sourceFiles(filename)
        return entry.isFile()&&/\.(?:[cm]?ts|tsx)$/.test(entry.name)?[filename]:[]
    })
}
function syntaxDiagnostics(files){
    const program=ts.createProgram(files,{noResolve:true,noLib:true,types:[],skipLibCheck:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX})
    return program.getSyntacticDiagnostics()
}
module.exports={sourceFiles,syntaxDiagnostics}
if(require.main===module){
    const root=path.resolve(__dirname,'../../..')
    const files=['packages/desktop-v3/renderer','packages/desktop-v3/main','packages/desktop-v3/shared','packages/player/src','packages/platform/src','packages/pages/src'].flatMap(relative=>sourceFiles(path.join(root,relative)))
    const diagnostics=syntaxDiagnostics(files)
    if(diagnostics.length){
        console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}))
        process.exitCode=1
    }else console.log('Parsed '+files.length+' V3 TypeScript source files successfully (syntax only).')
}
