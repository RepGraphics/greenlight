// Compatibility layer for the Classic xbox-xcloud-player 0.2.11 driver.
// Classic exposes one virtual Xbox controller; keep the selected physical
// controller stable across browser index changes, with an explicit neutral
// frame before switching to a replacement. V3 handles multiplayer separately.
const neutral={GamepadIndex:0,Nexus:0,Menu:0,View:0,A:0,B:0,X:0,Y:0,DPadUp:0,DPadDown:0,DPadLeft:0,DPadRight:0,LeftShoulder:0,RightShoulder:0,LeftThumb:0,RightThumb:0,LeftThumbXAxis:0,LeftThumbYAxis:0,RightThumbXAxis:0,RightThumbYAxis:0,LeftTrigger:0,RightTrigger:0}
type Frame={GamepadIndex:number;[name:string]:number}
export class ClassicPrimaryInput {
    private selected:number|null=null
    read(frames:Frame[]):Frame[]{
        const valid=frames.filter(frame=>frame&&Number.isSafeInteger(frame.GamepadIndex)&&frame.GamepadIndex>=0)
        const current=valid.find(frame=>frame.GamepadIndex===this.selected)
        if(current)return [{...current,GamepadIndex:0}]
        if(this.selected!==null){this.selected=null;return [{...neutral}]}
        const next=valid.sort((a,b)=>a.GamepadIndex-b.GamepadIndex)[0]
        if(!next)return []
        this.selected=next.GamepadIndex
        return [{...next,GamepadIndex:0}]
    }
    reset(){this.selected=null}
}
type Driver={
    requestStates:()=>Frame[]
    run:()=>void
    stop:()=>void
    _nexusOverrideN?:boolean
    _application?:{getChannelProcessor:(name:string)=>InputChannel|undefined}
}
type InputChannel={_state?:string;getGamepadQueueLength:()=>number;queueGamepadStates:(frames:Frame[])=>void;_inputFps?:{count:()=>void}}
const installed=new WeakSet<object>()
export function installClassicInputLifecycle(value:unknown,schedule:typeof setTimeout=setTimeout,cancel:typeof clearTimeout=clearTimeout){
    if(!value||typeof value!=='object'||installed.has(value))return false
    const driver=value as Driver
    if(typeof driver.requestStates!=='function'||typeof driver.run!=='function'||typeof driver.stop!=='function')return false
    installed.add(value)
    const primary=new ClassicPrimaryInput()
    const request=driver.requestStates
    const stop=driver.stop
    let running=false
    let generation=0
    let timer:ReturnType<typeof setTimeout>|undefined
    driver.requestStates=()=>primary.read(request.call(driver))
    const halt=()=>{generation++;running=false;if(timer!==undefined)cancel(timer);timer=undefined;primary.reset()}
    driver.stop=function(){halt();return stop.call(this)}
    // Upstream run() recursively schedules itself but never cancels the
    // timeout in stop(). Own one cancellable polling loop instead.
    const tick=(epoch:number)=>{
        const current=()=>running&&generation===epoch
        // A cancelled callback can already be queued when a new run starts.
        // Do not let it send input or clear the newer run's timer.
        if(!current())return
        timer=undefined
        try{
            const channel=driver._application?.getChannelProcessor('input')
            if(!current())return
            if(!channel||channel._state==='closed'||channel._state==='closing'){halt();return}
            // Keep the queue bounded when the transport is slow. Do not
            // consume a pending neutral frame until there is room for it.
            if(channel.getGamepadQueueLength()<4){
                if(!current())return
                const frames=driver.requestStates()
                if(!current())return
                if(frames.length){
                    if(driver._nexusOverrideN===true)frames[0].Nexus=1
                    channel.queueGamepadStates(frames)
                }
                if(current())channel._inputFps?.count()
            }
        }catch{if(current())halt();return}
        if(current())timer=schedule(()=>tick(epoch),1000/60)
    }
    driver.run=()=>{if(running)return;running=true;tick(++generation)}
    return true
}
