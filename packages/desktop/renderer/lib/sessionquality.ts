// Use the same range and step as Settings -> Streaming. Zero removes
// the requested SDP cap, rather than restoring a previous numeric override.
export function validSessionBitrate(value:unknown):value is number{
    return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=40960&&value%1024===0
}
export const sessionBitrates=Array.from({length:41},(_,index)=>index*1024)
export function selectableSessionBitrates(active:number){
    return sessionBitrates.filter(cap=>cap!==active)
}
export function parseSessionBitrate(value:string):number|null{
    if(!/^(0|[1-9]\d*)$/.test(value))return null
    const cap=Number(value)
    return validSessionBitrate(cap)?cap:null
}
export function sessionBitrateLabel(cap:number,automatic:string){
    return cap===0?automatic:Math.round(cap/1000)+' Mbps'
}
