import IpcBase from './base'

export default class IpcConsoles extends IpcBase {
    _consoles:any[]=[]
    _consolesLastUpdate=0
    private provider:unknown
    private refreshing:Promise<any[]>|undefined
    private pendingPower=new Set<string>()

    async get(args:{force?:boolean}={}){
        const provider=this._application._webApi?.providers.smartglass
        if(!provider)throw Error('Sign in to Xbox first')
        if(this.provider!==provider){
            this.provider=provider
            this._consoles=[]
            this._consolesLastUpdate=0
            this.refreshing=undefined
        }
        if(this.refreshing)return this.refreshing
        if(this._consolesLastUpdate&&Date.now()-this._consolesLastUpdate<(args?.force===true?5000:60000))return this._consoles
        const request=Promise.resolve().then(()=>provider.getConsolesList()).then(response=>{
            if(!Array.isArray(response.data?.result))throw Error('Console list unavailable')
            if(this.provider===provider){this._consoles=response.data.result;this._consolesLastUpdate=Date.now()}
            return response.data.result
        }).finally(()=>{if(this.refreshing===request)this.refreshing=undefined})
        this.refreshing=request
        return request
    }

    isPowerPending(consoleId:string){return this.pendingPower.has(consoleId)}

    async power(args:{consoleId:string;action:'on'|'off'}){
        const id=args?.consoleId, action=args?.action
        if(typeof id!=='string'||!id.trim()||id.length>128||(action!=='on'&&action!=='off'))throw Error('Invalid console power request')
        const provider=this._application._webApi?.providers.smartglass
        if(!this._application._authentication._isAuthenticated||!provider)throw Error('Sign in to Xbox first')
        const streaming=this._application._ipc._channels.streaming
        if(this.pendingPower.has(id))throw Error('Console power request already pending')
        if(streaming.hasHomeStream(id))throw Error('End the active stream before changing console power')
        this.pendingPower.add(id)
        try{
            // Validate ownership and remote management against the current signed-in account.
            const devices=await this.get({force:true})
            if(this._application._webApi?.providers.smartglass!==provider||!this._application._authentication._isAuthenticated)throw Error('Xbox account changed')
            if(!devices.some(item=>item?.id===id&&item.remoteManagementEnabled===true))throw Error('Console is not available for remote management')
            if(streaming.hasHomeStream(id))throw Error('End the active stream before changing console power')
            try{
                if(action==='on')await provider.powerOn(id)
                else await provider.powerOff(id)
            }catch{throw Error('Xbox did not accept the console power request')}
            this._consolesLastUpdate=0
            return {accepted:true}
        }finally{this.pendingPower.delete(id)}
    }
}
