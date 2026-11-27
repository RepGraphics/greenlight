import type xCloudPlayer from '../player'
import type VideoComponent from './video'
import type WebGPUComponent from './webgpu'

type LabelTone='ok'|'warning'|'error'
type FrameStats={renderingFps:number;renderDelayMs:number;droppedFrames:number}
const metric=(value:number,suffix='')=>Number.isFinite(value)&&value>=0?Number(value.toFixed(2))+suffix:'Unavailable'

export default class Overlay {
    private debug?:HTMLElement
    private timer?:ReturnType<typeof setInterval>

    constructor(private _videoComponent:VideoComponent|WebGPUComponent,private _player:xCloudPlayer,
        private schedule=setInterval.bind(globalThis),private cancel=clearInterval.bind(globalThis),private now=()=>performance.now()){}

    toggleDebug(){
        if(this.debug)this.destroy()
        else this.createDebugOverlay()
    }

    createDebugOverlay(){
        if(this.debug)return
        const holder=document.getElementById(this._player.getElementId())
        if(!holder)return
        const debug=document.createElement('div')
        debug.id='playerDebugOverlay'
        Object.assign(debug.style,{
            position:'absolute',top:'0',left:'0',
            width:this._videoComponent.getElement()?.style.width||'100%',
            height:this._videoComponent.getElement()?.style.height||'auto',
            background:'linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.5) 100%)',
            padding:'10px',pointerEvents:'none',
        })
        holder.appendChild(debug)
        this.debug=debug
        this.refreshDebugOverlay()
        this.timer=this.schedule(()=>{
            if(this.debug===debug)this.refreshDebugOverlay()
        },500)
    }

    destroy(){
        if(this.timer!==undefined){this.cancel(this.timer);this.timer=undefined}
        this.debug?.remove()
        this.debug=undefined
    }

    refreshDebugOverlay(){
        const debug=this.debug
        if(!debug)return
        const stats=this._player.getStats()
        const age=this.now()-stats.lastStatsAt
        const fresh=stats.lastStatsAt>0&&Number.isFinite(age)&&age>=0&&age<5000
        const labels:HTMLElement[]=[]
        const add=(name:string,value:string,tone:LabelTone='ok')=>labels.push(this.createLabel(name,value,tone))
        add('Network stats',fresh?'Live':stats.lastStatsAt>0?'Stale':'Waiting',fresh?'ok':'warning')
        if(fresh){
            add('Local Play',stats._remoteIsLocal?'Local':'Remote')
            add('Resolution',metric(stats._videoWidth)+'x'+metric(stats._videoHeight))
            add('Stream FPS',metric(stats._videoFps),stats._videoFps>=58?'ok':'warning')
            add('Connection',stats._remoteIsIpv6?'IPv6':'IPv4')
            add('Video',String(stats._videoCodec||'Unknown').slice(0,128))
            const rtt=stats._rtt*1000
            add('RTT',rtt>0?metric(rtt,' ms'):'Unavailable',rtt>75?'error':rtt>40||rtt<=0?'warning':'ok')
            add('Bitrate',stats._bitrate>0?metric(stats._bitrate,' Mbps'):'Unavailable',stats._bitrate>0?'ok':'warning')
            add('Jitter',metric(stats._jitter,' ms'),stats._jitter>30?'error':stats._jitter>15?'warning':'ok')
            add('Packets lost (total)',metric(stats._packetsLost),stats._packetsLost>0?'warning':'ok')
        }
        // Renderer measurements are separate from incoming network statistics.
        const frameStats=(this._videoComponent as {getFrameStats?:()=>FrameStats}).getFrameStats?.()
        if(frameStats){
            add('Render FPS',metric(frameStats.renderingFps),frameStats.renderingFps>=58?'ok':'warning')
            add('Render Delay',metric(frameStats.renderDelayMs,' ms'),frameStats.renderDelayMs<16?'ok':frameStats.renderDelayMs<33?'warning':'error')
            add('Dropped Frames',metric(frameStats.droppedFrames),frameStats.droppedFrames===0?'ok':frameStats.droppedFrames<30?'warning':'error')
        }
        debug.replaceChildren(...labels)
    }

    createLabel(text:string,value='',style:LabelTone='ok'){
        const element=document.createElement('span')
        Object.assign(element.style,{
            borderRadius:'5px',background:'linear-gradient(0deg, rgba(28,26,26,1) 0%, rgba(47,45,45,1) 100%)',
            padding:'10px',fontSize:'12px',marginTop:'3px',marginRight:'10px',marginBottom:'2px',
            textTransform:'uppercase',color:'white',display:'inline-block',
        })
        // Codec identifiers and other upstream values are text, never HTML.
        element.textContent=value!==''?text+': ':text
        if(value!==''){
            const detail=document.createElement('span')
            detail.textContent=value
            const colors={error:'rgb(220, 53, 69)',warning:'rgb(255, 193, 7)',ok:'rgb(25, 135, 84)'}
            Object.assign(detail.style,{background:colors[style],borderRadius:'5px',padding:'4px 8px'})
            element.appendChild(detail)
        }
        return element
    }
}
