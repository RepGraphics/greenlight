const fs = require('node:fs')
const path = require('node:path')

// public/ is the generated asset directory, not a source directory.
function copyWebExport(source, destination) {
    if (!fs.existsSync(path.join(source, 'home', 'index.html'))) throw new Error('Missing V3 web export')
    try {
        if (fs.lstatSync(destination).isSymbolicLink()) throw new Error('Refusing to replace a symlinked asset directory')
    } catch (error) {
        if (error.code !== 'ENOENT') throw error
    }
    fs.rmSync(destination, {recursive:true,force:true})
    fs.cpSync(source, destination, {recursive:true})
}
module.exports = {copyWebExport}
if (require.main === module) {
    copyWebExport(path.resolve(__dirname, '../../desktop-v3/web-out'), path.resolve(__dirname, '../public'))
}
