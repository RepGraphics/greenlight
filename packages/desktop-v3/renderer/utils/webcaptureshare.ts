export type ShareResult='shared'|'cancelled'|'unavailable'|'failed'
type ShareHost={canShare?:(data:ShareData)=>boolean;share?:(data:ShareData)=>Promise<void>}
const screenshotName=/^greenlight-[0-9TZ.-]{1,40}\.png$/
const clipName=/^greenlight-clip-[0-9TZ.-]{1,40}(?:-trimmed)?\.webm$/
export function shareableCapture(blob:Blob,name:string){
    if(blob.size<=0||blob.size>128*1024*1024)return false
    return (screenshotName.test(name)&&blob.type==='image/png')||(clipName.test(name)&&/^video\/webm(?:;.*)?$/i.test(blob.type))
}
function shareData(blob:Blob,name:string):ShareData{
    if(!shareableCapture(blob,name))throw Error('Invalid capture')
    return {files:[new File([blob],name,{type:name.endsWith('.png')?'image/png':'video/webm'})]}
}
export function canShareCapture(host:ShareHost,blob:Blob,name:string){
    try{return typeof host.share==='function'&&typeof host.canShare==='function'&&host.canShare(shareData(blob,name))}catch{return false}
}
export async function shareCapture(host:ShareHost,blob:Blob,name:string):Promise<ShareResult>{
    try{
        if(typeof host.share!=='function'||typeof host.canShare!=='function')return 'unavailable'
        const data=shareData(blob,name)
        if(!host.canShare(data))return 'unavailable'
        // Called directly from a user gesture. Do not upload or fall back to
        // network sharing; the OS chooser owns the selected destination.
        await host.share(data)
        return 'shared'
    }catch(error){return error instanceof Error&&error.name==='AbortError'?'cancelled':'failed'}
}
