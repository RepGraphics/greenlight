export type CaptureKind = 'screenshot'|'clip'
export interface CaptureInfo { id:string; kind:CaptureKind; name:string; createdAt:number; size:number }
interface Capture extends CaptureInfo { blob:Blob }
export type CaptureSort='newest'|'oldest'|'largest'|'name'
export function filterCaptures(entries:CaptureInfo[],kind:string,query:string,sort:CaptureSort){
    const term=query.trim().toLowerCase()
    return entries.filter(item=>(kind==='all'||item.kind===kind)&&(!term||item.name.toLowerCase().includes(term))).sort((a,b)=>sort==='oldest'?a.createdAt-b.createdAt:sort==='largest'?b.size-a.size:sort==='name'?a.name.localeCompare(b.name):b.createdAt-a.createdAt)
}
export const captureLimitBytes=512*1024*1024
export const captureLimitCount=200
export function canStoreCapture(size:number,count:number,total:number){
    return Number.isSafeInteger(size)&&size>0&&Number.isSafeInteger(count)&&count>=0&&count<captureLimitCount&&Number.isSafeInteger(total)&&total>=0&&size+total<=captureLimitBytes
}
function openLibrary():Promise<IDBDatabase>{
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open('greenlight-captures',1)
        request.onupgradeneeded=()=>{request.result.createObjectStore('captures',{keyPath:'id'});request.result.createObjectStore('index',{keyPath:'id'})}
        request.onerror=()=>reject(request.error)
        request.onblocked=()=>reject(new Error('Capture library is busy'))
        request.onsuccess=()=>resolve(request.result)
    })
}
async function transaction<T>(mode:IDBTransactionMode,run:(tx:IDBTransaction,resolve:(value:T)=>void,reject:(error:unknown)=>void)=>void):Promise<T>{
    const db=await openLibrary()
    try{return await new Promise<T>((resolve,reject)=>{
        const tx=db.transaction(['captures','index'],mode)
        let value:T
        tx.oncomplete=()=>resolve(value)
        tx.onerror=()=>reject(tx.error)
        tx.onabort=()=>reject(tx.error||new Error('Capture transaction aborted'))
        try{run(tx,result=>{value=result},error=>{reject(error);try{tx.abort()}catch{}})}catch(error){reject(error);try{tx.abort()}catch{}}
    })}finally{db.close()}
}
export async function listCaptures(){
    return transaction<CaptureInfo[]>('readonly',(tx,done)=>{const req=tx.objectStore('index').getAll();req.onsuccess=()=>done((req.result as CaptureInfo[]).sort((a,b)=>b.createdAt-a.createdAt))})
}
export async function storeCapture(kind:CaptureKind,blob:Blob){
    if(!['screenshot','clip'].includes(kind)||!(blob instanceof Blob)||(kind==='screenshot'?blob.type!=='image/png':!blob.type.startsWith('video/webm')))throw new Error('Unsupported capture format')
    const createdAt=Date.now()
    const info:CaptureInfo={id:crypto.randomUUID(),kind,createdAt,size:blob.size,name:'greenlight-'+(kind==='clip'?'clip-':'')+new Date(createdAt).toISOString().replace(/[:.]/g,'-')+(kind==='clip'?'.webm':'.png')}
    return transaction<CaptureInfo>('readwrite',(tx,done,fail)=>{
        const request=tx.objectStore('index').getAll()
        request.onsuccess=()=>{
            const entries=request.result as CaptureInfo[]
            if(!canStoreCapture(blob.size,entries.length,entries.reduce((sum,item)=>sum+item.size,0))){fail(new Error('Capture library limit reached'));return}
            tx.objectStore('captures').add({...info,blob});tx.objectStore('index').add(info);done(info)
        }
    })
}
export async function getCapture(id:string){
    return transaction<Capture|undefined>('readonly',(tx,done)=>{const req=tx.objectStore('captures').get(id);req.onsuccess=()=>done(req.result)})
}
export function captureName(value:unknown,kind:CaptureKind):string|null{
    if(typeof value!=='string')return null
    const base=value.trim().replace(/\.(png|webm)$/i,'').trim()
    if(!base||base.length>80||/[\\/:*?"<>|\x00-\x1f]/.test(base)||/^\.+$/.test(base)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base))return null
    return base+(kind==='clip'?'.webm':'.png')
}
export async function renameCapture(id:string,value:unknown){
    return transaction<void>('readwrite',(tx,done,fail)=>{
        const req=tx.objectStore('captures').get(id)
        req.onsuccess=()=>{const capture=req.result as Capture|undefined;const name=capture?captureName(value,capture.kind):null;if(!capture||!name){fail(new Error('Invalid capture name'));return}const updated={...capture,name};tx.objectStore('captures').put(updated);const {blob,...info}=updated;tx.objectStore('index').put(info);done(undefined)}
    })
}
export async function deleteCapture(id:string){
    return transaction<void>('readwrite',(tx,done)=>{tx.objectStore('captures').delete(id);tx.objectStore('index').delete(id);done(undefined)})
}
export function downloadCapture(blob:Blob,name:string){
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
}
