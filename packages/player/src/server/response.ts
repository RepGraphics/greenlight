// Bound upstream data before decoding it. Empty acknowledgement bodies are
// legitimate; malformed nonempty responses are not successful acknowledgements.
export const streamingResponseLimit=4*1024*1024
export const transferTokenResponseLimit=1024*1024

export async function readStreamingResponse(response:Response,limit:number):Promise<unknown>{
    const length=response.headers.get('content-length')
    if(length!==null&&Number(length)>limit){
        await response.body?.cancel().catch(()=>{})
        throw Error('Xbox response too large')
    }
    if(!response.body)return undefined
    const reader=response.body.getReader()
    const decoder=new TextDecoder('utf-8',{fatal:true})
    let bytes=0,text=''
    try{
        while(true){
            const {done,value}=await reader.read()
            if(done)break
            bytes+=value.byteLength
            if(bytes>limit)throw Error('Xbox response too large')
            text+=decoder.decode(value,{stream:true})
        }
        text+=decoder.decode()
        if(!text.trim())return undefined
        const value:unknown=JSON.parse(text)
        // Signaling and transfer-token responses are objects. Reject null,
        // scalars and arrays rather than interpreting them as acknowledgements.
        if(value===null||typeof value!=='object'||Array.isArray(value))throw Error('Invalid response shape')
        return value
    }catch(error){
        if(error instanceof Error&&error.message==='Xbox response too large')throw Error('Xbox response too large')
        throw Error('Invalid Xbox response')
    }finally{
        await reader.cancel().catch(()=>{})
        reader.releaseLock()
    }
}
