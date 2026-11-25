import type {ClientRequest,IncomingMessage,RequestOptions} from 'node:http'

export const xboxRequestDeadlineMs=15000
const maxResponseBytes=16*1024*1024
type RequestFactory=(options:RequestOptions,callback:(response:IncomingMessage)=>void)=>ClientRequest
type XboxResponse={status:number;body:string;data:any}

// Unlike socket inactivity timeouts, this timer covers DNS, TLS, headers,
// and the entire response body. Never retry a POST/DELETE implicitly.
export function requestXboxJson(
    request:RequestFactory,options:RequestOptions,body?:string,
    timeoutMs=xboxRequestDeadlineMs,schedule:typeof setTimeout=setTimeout,cancel:typeof clearTimeout=clearTimeout,
):Promise<XboxResponse>{
    return new Promise((resolve,reject)=>{
        let settled=false
        let req:ClientRequest|undefined
        let timer:ReturnType<typeof setTimeout>|undefined
        const finish=(error:Error|null,value?:XboxResponse)=>{
            if(settled)return
            settled=true
            if(timer!==undefined)cancel(timer)
            if(error)reject(error)
            else resolve(value!)
        }
        const fail=(error:Error)=>{if(settled)return;finish(error);req?.destroy()}
        timer=schedule(()=>fail(Error('Xbox API request timed out')),Math.max(1,Math.min(xboxRequestDeadlineMs,timeoutMs)))
        try{
            req=request(options,response=>{
                if(settled){response.destroy();return}
                const chunks:Buffer[]=[]
                let size=0
                response.on('data',chunk=>{
                    if(settled)return
                    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)
                    size+=bytes.length
                    if(size>maxResponseBytes){fail(Error('Xbox API response too large'));return}
                    chunks.push(bytes)
                })
                response.on('aborted',()=>fail(Error('Xbox API response interrupted')))
                response.on('error',()=>fail(Error('Xbox API response interrupted')))
                response.on('close',()=>{if(!response.complete)fail(Error('Xbox API response interrupted'))})
                response.on('end',()=>{
                    if(settled)return
                    if(!response.complete||!response.statusCode){fail(Error('Incomplete Xbox API response'));return}
                    const text=Buffer.concat(chunks).toString('utf8')
                    let data:any=text
                    try{data=JSON.parse(text)}catch{/* Some successful endpoints return non-JSON. */}
                    finish(null,{status:response.statusCode,body:text,data})
                })
            })
            req.on('error',error=>fail(error))
            req.on('close',()=>{if(!settled)fail(Error('Xbox API connection closed'))})
            if(body!==undefined)req.write(body)
            req.end()
        }catch(error){fail(error instanceof Error?error:Error('Xbox API request failed'))}
    })
}
