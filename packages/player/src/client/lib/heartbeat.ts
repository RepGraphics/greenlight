// Keep one request in flight. A stalled transport must not disable liveness
// monitoring forever or start overlapping keepalive requests.
export const heartbeatTimeoutMs=45000
export const heartbeatIntervalMs=20000
export const heartbeatRetryMs=5000
export class StreamHeartbeat{
    private timer:ReturnType<typeof setTimeout>|undefined
    private deadline:ReturnType<typeof setTimeout>|undefined
    private started=false
    private disposed=false
    private failures=0
    constructor(private send:()=>Promise<unknown>,private fail:()=>void,private schedule=setTimeout,private cancel=clearTimeout){}
    start(){
        if(this.started||this.disposed)return
        this.started=true
        void this.run()
    }
    private terminate(){
        if(this.disposed)return
        this.dispose()
        this.fail()
    }
    private async run(){
        if(this.disposed)return
        this.timer=undefined
        this.deadline=this.schedule(()=>this.terminate(),heartbeatTimeoutMs)
        try{
            await this.send()
            if(this.disposed)return
            this.failures=0
        }catch{
            if(this.disposed)return
            if(++this.failures>=3){this.terminate();return}
        }finally{
            if(this.deadline!==undefined)this.cancel(this.deadline)
            this.deadline=undefined
        }
        if(!this.disposed)this.timer=this.schedule(()=>{void this.run()},this.failures?heartbeatRetryMs:heartbeatIntervalMs)
    }
    dispose(){
        this.disposed=true
        if(this.timer!==undefined)this.cancel(this.timer)
        if(this.deadline!==undefined)this.cancel(this.deadline)
        this.timer=undefined;this.deadline=undefined
    }
}
