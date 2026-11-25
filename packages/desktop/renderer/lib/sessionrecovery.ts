// Only retry console sessions automatically after a previously established connection.
export function recoveryDelay(enabled:boolean, cloud:boolean, connected:boolean, failures:number):number|null {
    if(!enabled || cloud || !connected || !Number.isInteger(failures) || failures<0 || failures>=2) return null
    return [3000,8000][failures]
}

export class ManualReconnect {
    private pending=false
    private disposed=false
    get busy(){return this.pending}
    dispose(){this.disposed=true}
    async run(stop:()=>Promise<unknown>,restart:()=>void,onError:()=>void){
        if(this.pending||this.disposed)return false
        this.pending=true
        try{await stop();if(this.disposed)return false;restart();return true}
        catch{if(!this.disposed)onError();return false}
        finally{this.pending=false}
    }
}

// A budget belongs to one console visit, not to a remounted Classic player.
export class ClassicRecoveryBudget {
    private connected=false
    private attempts=0
    markConnected(){this.connected=true}
    recordRetry(automatic:boolean){
        if(automatic)this.attempts++
        else{this.attempts=0;this.connected=false}
    }
    delay(enabled:boolean,cloud:boolean,state:{error:string;active:boolean;blocked:boolean}){
        if(!state.active||state.blocked||!['closed','keepalive','provisioning','unavailable'].includes(state.error))return null
        return recoveryDelay(enabled,cloud,this.connected,this.attempts)
    }
}
