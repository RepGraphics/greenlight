import type xCloudPlayer from '../player'
import type {PointerContact} from '../channel/input/packet'
import {normalizedTouchPoint} from './touchcoordinates'

// Keep the existing single-contact wire format. Do not register a virtual pad.
export default class Touch{
    private player?:xCloudPlayer
    private surface?:HTMLVideoElement
    private active:number|null=null
    private previousTouchAction=''
    constructor(_index=0){}
    private send(contact:PointerContact){this.player?._channels.input.queuePointerFrame({events:[contact]})}
    private release=()=>{
        if(this.active===null)return
        const pointer=this.active;this.active=null
        this.send({type:'pointerup',x:0,y:0,pressure:0})
        try{if(this.surface?.hasPointerCapture(pointer))this.surface.releasePointerCapture(pointer)}catch{}
    }
    private hidden=()=>{if(document.hidden)this.release()}
    private onPointer=(event:PointerEvent)=>{
        const surface=this.surface,player=this.player
        if(!surface||!player||event.pointerType!=='touch')return
        if(event.type==='pointerup'||event.type==='pointercancel'||event.type==='lostpointercapture'){
            if(this.active===event.pointerId){this.release();event.preventDefault()}
            return
        }
        if(player.consoleController||document.hidden||!document.hasFocus()||!surface.isConnected)return
        const input=player._channels.input
        if(!input.isOpen()||!input.getServerVideoWidth()||!input.getServerVideoHeight())return
        const down=event.type==='pointerdown'
        if(down?this.active!==null:this.active!==event.pointerId)return
        const point=normalizedTouchPoint(event.clientX,event.clientY,surface.getBoundingClientRect(),surface.videoWidth,surface.videoHeight,getComputedStyle(surface).objectFit,down)
        if(!point)return
        if(down){
            try{surface.setPointerCapture(event.pointerId)}catch{return}
            this.active=event.pointerId
        }
        this.send({type:down?'pointerdown':'pointermove',...point,pressure:Number.isFinite(event.pressure)?Math.max(0,Math.min(1,event.pressure)):0})
        event.preventDefault()
    }
    attach(player:xCloudPlayer){
        this.detach()
        const surface=player.getVideoElement()
        if(player.consoleController||!surface||surface.tagName!=='VIDEO'||!surface.isConnected)return
        this.player=player;this.surface=surface as HTMLVideoElement
        this.previousTouchAction=surface.style.touchAction;surface.style.touchAction='none'
        for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])surface.addEventListener(name,this.onPointer as EventListener,{passive:false})
        window.addEventListener('blur',this.release);document.addEventListener('visibilitychange',this.hidden)
        player._channels.message.setTouchInputEnabled(true)
    }
    detach(){
        const surface=this.surface
        if(!surface)return
        this.release()
        this.player?._channels.message.setTouchInputEnabled(false)
        for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])surface.removeEventListener(name,this.onPointer as EventListener)
        surface.style.touchAction=this.previousTouchAction
        window.removeEventListener('blur',this.release);document.removeEventListener('visibilitychange',this.hidden)
        this.surface=undefined;this.player=undefined
    }
}
