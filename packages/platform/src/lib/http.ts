// The catalog adapter only uses these production endpoints. Never include
// request headers, response headers, upstream error bodies or URLs in RPC data.
const trustedHosts=new Set(['weu.core.gssv-play-prod.xboxlive.com','catalog.gamepass.com'])
export const platformResponseLimit=16*1024*1024
export const platformRequestDeadline=15000

export class HttpResponse<T=any>{
    constructor(public data:T){}
    body(){return this.data}
}

export default class Http {
    constructor(private request:typeof fetch=fetch){}
    private async send(host:string,path:string,headers:HeadersInit,method:string,body?:string):Promise<HttpResponse>{
        if(!trustedHosts.has(host)||!path.startsWith('/')||path.startsWith('//')||path.includes('\\')||path.includes('#'))throw Error('Invalid catalog destination')
        const url=new URL(path,'https://'+host)
        if(url.hostname!==host||url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Invalid catalog destination')
        try{
            const signal=AbortSignal.timeout(platformRequestDeadline)
            const response=await this.request(url.href,{method,headers,body,redirect:'error',signal,cache:'no-store'})
            if(!response.ok){
                await response.body?.cancel().catch(()=>{})
                throw Error('Catalog request failed (HTTP '+response.status+')')
            }
            const size=response.headers.get('content-length')
            if(size!==null&&Number(size)>platformResponseLimit){
                await response.body?.cancel().catch(()=>{})
                throw Error('Catalog response too large')
            }
            if(response.status===204||!response.body)return new HttpResponse({})
            const reader=response.body.getReader(),decoder=new TextDecoder()
            let bytes=0,text=''
            try{
                while(true){
                    signal.throwIfAborted()
                    const {done,value}=await reader.read()
                    if(done)break
                    bytes+=value.byteLength
                    if(bytes>platformResponseLimit)throw Error('Catalog response too large')
                    text+=decoder.decode(value,{stream:true})
                }
                text+=decoder.decode()
                signal.throwIfAborted()
                return new HttpResponse(text.trim()?JSON.parse(text):{})
            }finally{
                await reader.cancel().catch(()=>{})
                reader.releaseLock()
            }
        }catch(error){
            // Upstream exceptions can include headers, URLs or response data.
            // Do not expose them through the public RPC error formatter.
            if(error instanceof Error&&/^Catalog (request failed \(HTTP \d{3}\)|response too large)$/.test(error.message))throw Error(error.message)
            throw Error('Catalog request unavailable')
        }
    }
    getRequest(host:string,path:string,headers:HeadersInit,method='GET'){return this.send(host,path,headers,method)}
    deleteRequest(host:string,path:string,headers:HeadersInit){return this.send(host,path,headers,'DELETE')}
    postRequest(host:string,path:string,headers:HeadersInit,data:unknown,method='POST'){
        const requestHeaders=new Headers(headers)
        if(typeof data!=='string')requestHeaders.set('Content-Type','application/json')
        return this.send(host,path,requestHeaders,method,typeof data==='string'?data:JSON.stringify(data))
    }
    putRequest(host:string,path:string,headers:HeadersInit,data:unknown){return this.postRequest(host,path,headers,data,'PUT')}
}
