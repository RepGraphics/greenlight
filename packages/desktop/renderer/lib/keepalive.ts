export interface HeartbeatOptions {
    send:()=>Promise<unknown>
    onFailure?:(count:number,error:unknown)=>void
    onSuccess?:()=>void
    schedule?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>
    cancel?:(timer:ReturnType<typeof setTimeout>)=>void
}
export function startHeartbeat({send,onFailure,onSuccess,schedule=setTimeout,cancel=clearTimeout}:HeartbeatOptions){
    let stopped=false
    let timer:ReturnType<typeof setTimeout>|undefined
    let failures=0
    const tick=async()=>{
        if(stopped)return
        try{await send();if(stopped)return;failures=0;onSuccess?.()}
        catch(error){if(stopped)return;failures++;onFailure?.(failures,error)}
        finally{if(!stopped)timer=schedule(()=>{void tick()},failures?5000:20000)}
    }
    void tick()
    return ()=>{stopped=true;if(timer!==undefined)cancel(timer)}
}
