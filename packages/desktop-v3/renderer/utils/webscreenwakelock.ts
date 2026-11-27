export type ScreenWakeState='off'|'requesting'|'active'|'paused'|'failed'|'unavailable'
export type ScreenWakeLease=Pick<WakeLockSentinel,'released'|'release'|'addEventListener'|'removeEventListener'>

// Each controller owns at most one sentinel. A pending browser request cannot
// be cancelled, so release its result if the session is no longer eligible.
export class WebScreenWakeLock{
    private enabled=false
    private pending=false
    private disposed=false
    private lease?:ScreenWakeLease
    private releaseListener?:()=>void
    constructor(private request:(()=>Promise<ScreenWakeLease>)|undefined,private visible:boolean,private update:(state:ScreenWakeState)=>void){}
    private publish(state:ScreenWakeState){if(!this.disposed)this.update(state)}
    private eligible(){return !this.disposed&&this.enabled&&this.visible}
    private async release(lease:ScreenWakeLease){
        try{if(!lease.released)await lease.release()}catch{/* Browser owns the underlying lock. */}
    }
    private drop(){
        const lease=this.lease
        const listener=this.releaseListener
        this.lease=undefined
        this.releaseListener=undefined
        if(lease){
            if(listener)lease.removeEventListener('release',listener)
            void this.release(lease)
        }
    }
    async setEnabled(value:boolean){
        if(this.disposed)return
        this.enabled=value
        if(!value){this.drop();this.publish('off');return}
        await this.acquire()
    }
    async setVisible(value:boolean){
        if(this.disposed||this.visible===value)return
        this.visible=value
        if(!value){
            this.drop()
            if(this.enabled)this.publish('paused')
            return
        }
        if(this.enabled)await this.acquire()
    }
    async retry(){if(this.eligible())await this.acquire()}
    private async acquire(){
        if(!this.request){this.publish('unavailable');return}
        if(!this.eligible()){if(this.enabled)this.publish('paused');return}
        if(this.lease&&!this.lease.released){this.publish('active');return}
        if(this.pending){this.publish('requesting');return}
        this.pending=true
        this.publish('requesting')
        try{
            const lease=await this.request()
            if(!this.eligible()){void this.release(lease);return}
            if(lease.released){this.publish('paused');return}
            this.drop()
            this.lease=lease
            this.releaseListener=()=>{
                if(this.lease!==lease)return
                this.drop()
                if(this.enabled)this.publish('paused')
            }
            lease.addEventListener('release',this.releaseListener)
            this.publish('active')
        }catch{this.drop();if(this.eligible())this.publish('failed')}
        finally{this.pending=false}
    }
    dispose(){
        this.disposed=true
        this.enabled=false
        this.drop()
    }
}
