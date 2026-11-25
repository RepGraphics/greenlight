export const classicDisconnectGraceMs=10000
export const classicHandshakeDeadlineMs=45000
export function watchClassicConnection(onFailure:()=>void,schedule=setTimeout,cancel=clearTimeout){
    let timer:ReturnType<typeof setTimeout>|undefined
    let handshake:ReturnType<typeof setTimeout>|undefined
    let established=false
    let disposed=false
    let failed=false
    const clear=()=>{if(timer!==undefined){cancel(timer);timer=undefined}}
    const clearHandshake=()=>{if(handshake!==undefined){cancel(handshake);handshake=undefined}}
    const fail=()=>{if(disposed||failed)return;clear();clearHandshake();failed=true;onFailure()}
    return {
        get failed(){return failed},
        begin(){if(!disposed&&!failed&&!established&&handshake===undefined)handshake=schedule(fail,classicHandshakeDeadlineMs)},
        update(state:string){
            if(disposed||failed)return
            if(state==='failed'||state==='closed'){fail();return}
            // A short disconnected state can be recovered by WebRTC itself.
            // Repeated events or connecting transitions must not extend its deadline.
            if(state==='connected'){established=true;clear();clearHandshake();return}
            if(state==='disconnected'&&timer===undefined)timer=schedule(fail,classicDisconnectGraceMs)
        },
        dispose(){disposed=true;clear();clearHandshake()}
    }
}
