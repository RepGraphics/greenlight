import {open,unlink,stat} from 'node:fs/promises'
import {basename,extname,isAbsolute,resolve,dirname} from 'node:path'
export const captureExportLimit=128*1024*1024
type CaptureExport={name:string;kind:'screenshot'|'clip';bytes:Uint8Array}
export function validateCaptureExport(value:unknown):CaptureExport{
    if(!value||typeof value!=='object')throw Error('Invalid capture')
    const {name,kind,bytes}=value as Partial<CaptureExport>
    if(kind!=='screenshot'&&kind!=='clip')throw Error('Invalid capture type')
    const ext=kind==='screenshot'?'.png':'.webm'
    if(typeof name!=='string'||name.length>85||basename(name)!==name||extname(name).toLowerCase()!==ext)throw Error('Invalid capture filename')
    const base=name.slice(0,-ext.length)
    if(!base.trim()||/[\\/:*?"<>|\x00-\x1f]/.test(base)||/[. ]$/.test(base)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base))throw Error('Invalid capture filename')
    if(!(bytes instanceof Uint8Array)||bytes.byteLength>captureExportLimit)throw Error('Invalid capture size')
    const signature=kind==='screenshot'?[137,80,78,71,13,10,26,10]:[26,69,223,163]
    if(bytes.byteLength<signature.length||signature.some((byte,index)=>bytes[index]!==byte))throw Error('Unsupported capture format')
    return {name:base+ext,kind,bytes}
}
export async function exportCaptureFile(directory:string,value:unknown){
    const capture=validateCaptureExport(value)
    if(!isAbsolute(directory)||!(await stat(directory)).isDirectory())throw Error('Capture folder unavailable')
    const root=resolve(directory),ext=extname(capture.name),base=basename(capture.name,ext)
    for(let attempt=0;attempt<100;attempt++){
        const name=base+(attempt?' ('+attempt+')':'')+ext
        const target=resolve(root,name)
        if(dirname(target)!==root)throw Error('Invalid capture destination')
        let file
        try{file=await open(target,'wx',0o600)}
        catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')continue;throw error}
        try{await file.writeFile(capture.bytes);await file.close();return name}
        catch(error){await file.close().catch(()=>{});await unlink(target).catch(()=>{});throw error}
    }
    throw Error('Too many duplicate capture names')
}
