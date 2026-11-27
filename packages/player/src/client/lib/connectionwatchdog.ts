export const v3ProvisioningDeadlineMs=30*60*1000
export const v3HandshakeDeadlineMs=45000
export const v3DisconnectGraceMs=15000

// The deadline belongs to the entire phase, not a single async call or event.
export class StreamConnectionWatchdog{
    private timer:ReturnType<typeof setTimeout>|undefined
    private phase:'idle'|'provisioning'|'handshake'|'connected'|'disconnected'|'terminal'='idle'
    private generation=0
    constructor(private fail:(reason:'server'|'transport')=>void,private schedule=setTimeout.bind(globalThis),private cancel=clearTimeout.bind(globalThis)){}
    private clear(){
        this.generation++
        if(this.timer!==undefined)this.cancel(this.timer)
        this.timer=undefined
    }
    private arm(delay:number,reason:'server'|'transport'){
        this.clear()
        const generation=this.generation
        this.timer=this.schedule(()=>{if(this.generation===generation)this.terminate(reason)},delay)
    }
    private terminate(reason:'server'|'transport'){
        if(this.phase==='terminal')return
        this.dispose();this.fail(reason)
    }
    beginProvisioning(){
        if(this.phase!=='idle')return
        this.phase='provisioning';this.arm(v3ProvisioningDeadlineMs,'server')
    }
    beginHandshake(){
        if(this.phase!=='provisioning')return
        this.phase='handshake';this.arm(v3HandshakeDeadlineMs,'transport')
    }
    update(state:string){
        if(this.phase==='terminal'||this.phase==='idle'||this.phase==='provisioning')return
        if(state==='failed'||state==='closed'){this.terminate('transport');return}
        if(state==='connected'){this.phase='connected';this.clear();return}
        if(state==='disconnected'&&this.phase==='connected'){
            this.phase='disconnected';this.arm(v3DisconnectGraceMs,'transport')
        }
        // During negotiation, or a transient disconnected -> connecting
        // transition, preserve the original deadline.
    }
    dispose(){this.phase='terminal';this.clear()}
}
