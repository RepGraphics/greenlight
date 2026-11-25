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
