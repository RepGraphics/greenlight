import type xCloudPlayer from '../player'

type Surface=HTMLVideoElement|HTMLCanvasElement
type Key={key:string;keyCode:number}
// A late pointer-lock promise must not unlock a newer driver's valid capture.
const owners=new WeakMap<Surface,MouseKeyboard>()
const keyIdentity=(event:KeyboardEvent)=>event.code&&event.code!=='Unidentified'?event.code:'vkey:'+event.keyCode

export default class MouseKeyboard {
    private player?:xCloudPlayer
    private element?:Surface
    private keys=new Map<string,Key>()
    private buttons=0
    private generation=0
    private requested=false
    private pending=false
    private ownsLock=()=>Boolean(this.element&&document.pointerLockElement===this.element)
    private locked=()=>this.requested&&this.ownsLock()&&!document.hidden&&document.hasFocus()

    constructor(private index:number,private sensitivity=1){}

    private releaseMouse=()=>{
        if(this.buttons)this.player?._channels.input.queueMouseFrame({X:0,Y:0,WheelX:0,WheelY:0,Buttons:0,Relative:0})
        this.buttons=0
    }
    private release=()=>{
        const sent=new Set<number>()
        for(const key of this.keys.values()){
            if(!sent.has(key.keyCode)){sent.add(key.keyCode);this.player?._channels.input.queueKeyboardFrame({...key,pressed:false})}
        }
        this.keys.clear();this.releaseMouse()
    }
    private cancelCapture=()=>{
        this.generation++;this.requested=false;this.pending=false
        this.release()
        if(this.ownsLock())document.exitPointerLock()
    }
    private onLock=()=>{
        if(!this.ownsLock()){
            this.generation++;this.requested=false;this.pending=false;this.release()
        }else if(!this.locked())this.cancelCapture()
    }
    private onVisibility=()=>{if(document.hidden)this.cancelCapture()}
    private onKeyDown=(event:KeyboardEvent)=>{
        if(!this.locked()||event.key==='Escape'||event.defaultPrevented||event.isComposing)return
        const code=event.keyCode
        if(!Number.isInteger(code)||code<1||code>255||code===229)return
        const id=keyIdentity(event)
        if(this.keys.has(id)){event.preventDefault();return}
        if(event.repeat)return
        const key={key:event.key,keyCode:code}
        const first=![...this.keys.values()].some(held=>held.keyCode===code)
        this.keys.set(id,key)
        if(first)this.player?._channels.input.queueKeyboardFrame({...key,pressed:true})
        event.preventDefault()
    }
    private onKeyUp=(event:KeyboardEvent)=>{
        const id=keyIdentity(event),key=this.keys.get(id)
        if(!key)return
        this.keys.delete(id)
        if(![...this.keys.values()].some(held=>held.keyCode===key.keyCode))this.player?._channels.input.queueKeyboardFrame({...key,pressed:false})
        event.preventDefault()
    }
    private onPointer=(event:PointerEvent)=>{
        if(!this.locked()||event.pointerType!=='mouse')return
        this.buttons=Number.isInteger(event.buttons)?event.buttons&31:0
        const sensitivity=Number.isFinite(this.sensitivity)?Math.max(0.25,Math.min(4,this.sensitivity)):1
        const move=(value:number)=>Number.isFinite(value)?Math.max(-32767,Math.min(32767,Math.round(value*sensitivity))):0
        this.player?._channels.input.queueMouseFrame({X:move(event.movementX),Y:move(event.movementY),WheelX:0,WheelY:0,Buttons:this.buttons,Relative:0})
        event.preventDefault()
    }
    private onPointerCancel=(event:PointerEvent)=>{if(event.pointerType==='mouse')this.releaseMouse()}
    private onWheel=(event:WheelEvent)=>{
        if(!this.locked())return
        const scale=event.deltaMode===1?16:event.deltaMode===2?120:1
        const clamp=(value:number)=>Number.isFinite(value)?Math.max(-32767,Math.min(32767,Math.round(value*scale))):0
        this.player?._channels.input.queueMouseFrame({X:0,Y:0,WheelX:clamp(event.deltaX),WheelY:clamp(event.deltaY),Buttons:this.buttons,Relative:0})
        event.preventDefault()
    }
    private onContext=(event:Event)=>{if(this.locked())event.preventDefault()}
    private lockMouseKeyboard=async()=>{
        const element=this.element
        if(!element||!element.isConnected||document.hidden||!document.hasFocus()||this.locked()||this.pending)return
        // Do not steal another surface's active pointer lock.
        if(document.pointerLockElement&&document.pointerLockElement!==element)return
        const generation=++this.generation
        this.requested=true;this.pending=true
        try{
            await element.requestPointerLock()
            if(generation!==this.generation){
                const owner=owners.get(element)
                if(document.pointerLockElement===element&&(!owner||!owner.locked()))document.exitPointerLock()
            }
        }catch{
            if(generation===this.generation)this.cancelCapture()
        }finally{
            if(generation===this.generation)this.pending=false
        }
    }

    attach(player:xCloudPlayer){
        this.detach()
        const element=player.getVideoElement()
        if(!element?.isConnected)return
        this.player=player;this.element=element;owners.set(element,this)
        element.addEventListener('click',this.lockMouseKeyboard)
        element.addEventListener('contextmenu',this.onContext)
        window.addEventListener('pointermove',this.onPointer)
        window.addEventListener('pointerdown',this.onPointer)
        window.addEventListener('pointerup',this.onPointer)
        window.addEventListener('pointercancel',this.onPointerCancel)
        window.addEventListener('wheel',this.onWheel,{passive:false})
        window.addEventListener('keydown',this.onKeyDown)
        window.addEventListener('keyup',this.onKeyUp)
        window.addEventListener('blur',this.cancelCapture)
        document.addEventListener('visibilitychange',this.onVisibility)
        document.addEventListener('pointerlockchange',this.onLock)
    }

    detach(){
        const element=this.element
        if(!element)return
        this.cancelCapture()
        if(owners.get(element)===this)owners.delete(element)
        element.removeEventListener('click',this.lockMouseKeyboard)
        element.removeEventListener('contextmenu',this.onContext)
        window.removeEventListener('pointermove',this.onPointer)
        window.removeEventListener('pointerdown',this.onPointer)
        window.removeEventListener('pointerup',this.onPointer)
        window.removeEventListener('pointercancel',this.onPointerCancel)
        window.removeEventListener('wheel',this.onWheel)
        window.removeEventListener('keydown',this.onKeyDown)
        window.removeEventListener('keyup',this.onKeyUp)
        window.removeEventListener('blur',this.cancelCapture)
        document.removeEventListener('visibilitychange',this.onVisibility)
        document.removeEventListener('pointerlockchange',this.onLock)
        this.element=undefined;this.player=undefined
    }
}
