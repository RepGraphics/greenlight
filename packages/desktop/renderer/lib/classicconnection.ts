export const classicDisconnectGraceMs=10000
export function watchClassicConnection(onFailure:()=>void,schedule=setTimeout,cancel=clearTimeout){
    let timer:ReturnType<typeof setTimeout>|undefined
    let disposed=false
    let failed=false
    const clear=()=>{if(timer!==undefined){cancel(timer);timer=undefined}}
    const fail=()=>{if(disposed||failed)return;clear();failed=true;onFailure()}
    return {
        get failed(){return failed},
        update(state:string){
            if(disposed||failed)return
            if(state==='failed'||state==='closed'){fail();return}
            // A short disconnected state can be recovered by WebRTC itself.
            // Repeated events or connecting transitions must not extend its deadline.
            if(state==='connected'){clear();return}
            if(state==='disconnected'&&timer===undefined)timer=schedule(fail,classicDisconnectGraceMs)
        },
        dispose(){disposed=true;clear()}
    }
}
