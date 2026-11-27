export function isRpcPath(path:string){return path==='/trpc'||path.startsWith('/trpc/')}
export function rpcRequestAllowed(method:string,search:string){
    // tRPC clients may include ?batch=1, but never credentials in query input.
    return method==='POST'&&(search===''||search==='?batch=1')
}
export const rpcHeaders={'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}

export const rpcBodyLimit=2*1024*1024
export const rpcBatchLimit=16

// Fetch Metadata is a browser cross-origin defence, not authentication.
// Do not compare Origin to a potentially rewritten reverse-proxy request URL.
export function rpcHeaderFailure(headers:Headers):400|403|413|415|null{
    const site=headers.get('sec-fetch-site')
    if(site!==null&&site!=='same-origin'&&site!=='none')return 403
    if(headers.get('origin')==='null')return 403
    const type=headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()
    if(type!=='application/json')return 415
    const encoding=headers.get('content-encoding')
    if(encoding&&encoding.trim().toLowerCase()!=='identity')return 415
    const length=headers.get('content-length')
    if(length!==null){
        if(!/^\d+$/.test(length))return 400
        if(Number(length)>rpcBodyLimit)return 413
    }
    return null
}
export function rpcPathAllowed(path:string){
    if(!isRpcPath(path)||path.length>4096)return false
    try{
        const procedures=decodeURIComponent(path.slice('/trpc/'.length)).split(',')
        return path.startsWith('/trpc/')&&procedures.length<=rpcBatchLimit&&procedures.every(name=>/^[a-zA-Z0-9_.]+$/.test(name))
    }catch{return false}
}
export class RpcBodyError extends Error{
    constructor(public readonly status:400|413){super('Invalid RPC body')}
}
export async function boundedRpcBody(body:ReadableStream<Uint8Array>|null):Promise<ArrayBuffer>{
    if(!body)throw new RpcBodyError(400)
    const reader=body.getReader()
    const chunks:Uint8Array[]=[]
    let size=0
    try{
        while(true){
            const {done,value}=await reader.read()
            if(done)break
            if(value.byteLength>rpcBodyLimit-size)throw new RpcBodyError(413)
            // Copy each chunk; do not retain an oversized backing buffer.
            chunks.push(Uint8Array.from(value))
            size+=value.byteLength
        }
        if(size===0)throw new RpcBodyError(400)
        const output=new Uint8Array(size)
        let offset=0
        for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength}
        return output.buffer
    }catch(error){
        void reader.cancel().catch(()=>{})
        throw error instanceof RpcBodyError?error:new RpcBodyError(400)
    }finally{reader.releaseLock()}
}
