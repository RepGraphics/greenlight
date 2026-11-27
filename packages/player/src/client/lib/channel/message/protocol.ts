export const messageLimit=64*1024
export type StreamMessage={type:'HandshakeAck'}|{type:'Message'|'TransactionStart';target:string;id:string;content:unknown}
const record=(value:unknown):Record<string,unknown>|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined
const validId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\x00-\x1f\x7f]/.test(value)
export function decodeStreamMessage(input:unknown):StreamMessage|undefined{
    try{
        let text:string
        if(typeof input==='string'){
            if(input.length>messageLimit)return
            text=input
        }else if(input instanceof ArrayBuffer||ArrayBuffer.isView(input)){
            if(input.byteLength>messageLimit)return
            const bytes=input instanceof ArrayBuffer?new Uint8Array(input):Uint8Array.from(new Uint8Array(input.buffer,input.byteOffset,input.byteLength))
            text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
        }else return
        const value=record(JSON.parse(text))
        if(!value)return
        if(value.type==='HandshakeAck')return {type:'HandshakeAck'}
        if((value.type!=='Message'&&value.type!=='TransactionStart')||!validId(value.id)||typeof value.target!=='string'||value.target.length>256)return
        return {type:value.type,id:value.id,target:value.target,content:value.content}
    }catch{return}
}
export function decodeMessageDialog(content:unknown):{title:string;body:string}|undefined{
    if(typeof content!=='string'||content.length>messageLimit)return
    try{
        const value=record(JSON.parse(content))
        if(!value||typeof value.TitleText!=='string'||typeof value.ContentText!=='string'||value.TitleText.length>512||value.ContentText.length>8192)return
        return {title:value.TitleText,body:value.ContentText}
    }catch{return}
}
