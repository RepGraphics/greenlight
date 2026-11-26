interface SessionAttempt {
    start:()=>Promise<unknown>
    stop:(sessionId:string)=>Promise<unknown>
    onSession:(sessionId:string)=>void
    onError:(reason:'start'|'stop')=>void
}

// Serialize provisioning and teardown, including sessions returned after a
// cancelled or timed-out attempt. A failed stop retains ownership for retry.
export class SessionLifecycle {
    private tail:Promise<void>=Promise.resolve()
    private cancelCurrent:((cleanup:boolean)=>void)|undefined
    private ending:Promise<boolean>|undefined
    private endOperation:Promise<boolean>|undefined
    private active:{id:string;owner:object;stop:SessionAttempt['stop']}|undefined
    constructor(private schedule=setTimeout,private cancel=clearTimeout,private timeoutMs=60000,private endTimeoutMs=120000){}
    private enqueue(operation:()=>Promise<void>){
        this.tail=this.tail.then(operation).catch(()=>{})
    }
    private async closeActive(){
        const session=this.active
        if(!session)return
        await session.stop(session.id)
        if(this.active===session)this.active=undefined
    }
    // Explicit exit owns teardown even when provisioning has not returned an ID.
    // It reports failure rather than silently discarding the remote session.
    end():Promise<boolean>{
        if(this.ending)return this.ending
        this.cancelCurrent?.(false)
        if(!this.endOperation){
            const operation=this.tail.then(()=>this.closeActive()).then(()=>true,()=>false)
            const pending=operation.finally(()=>{if(this.endOperation===pending)this.endOperation=undefined})
            this.endOperation=pending
            // Keep serialization tied to actual remote cleanup, not the
            // bounded UI wait. A replacement cannot overtake provisioning.
            this.tail=pending.then(()=>{})
        }
        const operation=this.endOperation
        const waiting=new Promise<boolean>(resolve=>{
            const timer=this.schedule(()=>resolve(false),this.endTimeoutMs)
            void operation.then(value=>{this.cancel(timer);resolve(value)})
        })
        const result=waiting.finally(()=>{if(this.ending===result)this.ending=undefined})
        this.ending=result
        return result
    }
    begin(attempt:SessionAttempt){
        const owner={}
        let disposed=false
        let timer:ReturnType<typeof setTimeout>|undefined
        const clear=()=>{if(timer!==undefined){this.cancel(timer);timer=undefined}}
        const cancelAttempt=(cleanup:boolean)=>{
            if(disposed)return
            disposed=true;clear()
            if(this.cancelCurrent===cancelAttempt)this.cancelCurrent=undefined
            if(cleanup)this.enqueue(async()=>{if(this.active?.owner===owner)await this.closeActive()})
        }
        this.cancelCurrent=cancelAttempt
        const dispose=()=>cancelAttempt(true)
        this.enqueue(async()=>{
            if(disposed)return
            try{await this.closeActive()}
            catch{if(!disposed)attempt.onError('stop');return}
            if(disposed)return
            timer=this.schedule(()=>{if(!disposed){dispose();attempt.onError('start')}},this.timeoutMs)
            let result:unknown
            try{
                result=await attempt.start()
                if(typeof result!=='string'||!result)throw Error('Invalid session identifier')
            }catch{
                if(!disposed)attempt.onError('start')
                return
            }finally{clear()}
            this.active={id:result as string,owner,stop:attempt.stop}
            if(!disposed)attempt.onSession(result as string)
        })
        return dispose
    }
}
