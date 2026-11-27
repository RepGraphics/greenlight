import {test} from 'node:test'
import assert from 'node:assert/strict'
import Overlay from '../../../player/src/client/lib/render/overlay'

class Element {
    id=''
    style:Record<string,string>={}
    textContent=''
    children:Element[]=[]
    parent?:Element
    set innerHTML(_value:string){assert.fail('Overlay must not interpret HTML')}
    appendChild(child:Element){child.parent=this;this.children.push(child)}
    replaceChildren(...children:Element[]){this.children.forEach(child=>child.parent=undefined);this.children=[];children.forEach(child=>this.appendChild(child))}
    remove(){if(this.parent){this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined}}
    text():string{return this.textContent+this.children.map(child=>child.text()).join('')}
}
function fixture(){
    const original=Object.getOwnPropertyDescriptor(globalThis,'document')
    const holder=new Element()
    let available=true,now=1000,id=0
    const callbacks=new Map<number,()=>void>()
    const stats={lastStatsAt:500,_remoteIsLocal:true,_remoteIsIpv6:false,_videoWidth:1920,_videoHeight:1080,_videoFps:60,_videoCodec:'video/H264',_rtt:.052,_bitrate:12.345,_jitter:4.567,_packetsLost:3}
    const renderer={getElement:()=>({style:{}}),getFrameStats:()=>({renderingFps:59,renderDelayMs:12,droppedFrames:2})}
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:()=>available?holder:null,createElement:()=>new Element()}})
    const overlay=new Overlay(renderer as any,{getElementId:()=> 'stream',getStats:()=>stats} as any,
        ((callback:()=>void)=>{callbacks.set(++id,callback);return id}) as unknown as typeof setInterval,
        ((timer:number)=>callbacks.delete(timer)) as unknown as typeof clearInterval,()=>now)
    return {overlay,holder,callbacks,stats,setNow:(value:number)=>{now=value},setAvailable:(value:boolean)=>{available=value},
        tick(){for(const callback of [...callbacks.values()])callback()},
        labels:()=>holder.children[0]?.children.map(child=>child.text())??[],
        restore(){overlay.destroy();if(original)Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document')}}
}
test('debug overlay starts exactly one interval and repeated creation is idempotent',()=>{
    const f=fixture()
    try{
        f.overlay.createDebugOverlay();f.overlay.createDebugOverlay();f.overlay.refreshDebugOverlay()
        assert.equal(f.holder.children.length,1);assert.equal(f.callbacks.size,1)
        f.overlay.destroy();f.overlay.destroy()
        assert.equal(f.callbacks.size,0);assert.equal(f.holder.children.length,0)
    }finally{f.restore()}
})
test('rapid toggling cannot revive a destroyed overlay or duplicate its refresh loop',()=>{
    const f=fixture()
    try{
        f.overlay.toggleDebug()
        const stale=[...f.callbacks.values()][0]
        f.overlay.toggleDebug();f.overlay.toggleDebug()
        const current=f.holder.children[0],labels=current.children
        stale()
        assert.equal(current.children,labels);assert.equal(f.callbacks.size,1)
        f.tick()
        assert.notEqual(current.children,labels)
        f.overlay.destroy();stale();assert.equal(f.holder.children.length,0)
    }finally{f.restore()}
})
test('missing stream surface never allocates a refresh timer',()=>{
    const f=fixture()
    try{
        f.setAvailable(false);f.overlay.createDebugOverlay()
        assert.equal(f.callbacks.size,0)
        f.setAvailable(true);f.overlay.createDebugOverlay()
        assert.equal(f.callbacks.size,1)
    }finally{f.restore()}
})
test('network diagnostics expose live values but hide stale and missing stats independently of renderer stats',()=>{
    const f=fixture()
    try{
        f.overlay.createDebugOverlay()
        assert.ok(f.labels().includes('Network stats: Live'))
        assert.ok(f.labels().includes('Bitrate: 12.35 Mbps'))
        assert.ok(f.labels().includes('Jitter: 4.57 ms'))
        assert.ok(f.labels().includes('RTT: 52 ms'))
        assert.ok(f.labels().includes('Packets lost (total): 3'))
        f.setNow(5500);f.tick()
        assert.ok(f.labels().includes('Network stats: Stale'))
        assert.ok(!f.labels().some(label=>label.startsWith('Bitrate:')))
        assert.ok(f.labels().includes('Render FPS: 59'))
        f.stats.lastStatsAt=0;f.tick()
        assert.ok(f.labels().includes('Network stats: Waiting'))
        f.stats.lastStatsAt=5499;f.tick()
        assert.ok(f.labels().includes('Network stats: Live'))
    }finally{f.restore()}
})
test('codec labels use literal text and invalid metrics are not rendered as numeric values',()=>{
    const f=fixture()
    try{
        f.stats._videoCodec='<img src=x onerror=alert(1)>'
        f.stats._bitrate=NaN;f.stats._rtt=0;f.stats._jitter=Infinity
        f.overlay.createDebugOverlay()
        assert.ok(f.labels().includes('Video: <img src=x onerror=alert(1)>'))
        assert.ok(f.labels().includes('Bitrate: Unavailable'))
        assert.ok(f.labels().includes('RTT: Unavailable'))
        assert.ok(f.labels().includes('Jitter: Unavailable'))
    }finally{f.restore()}
})

import {networkStatsFresh,nonnegativeMetric} from '../../../player/src/client/metrics'
test('shared statistics freshness rejects future, expired and nonfinite timestamps',()=>{
    assert.equal(networkStatsFresh(1000,5999),true)
    for(const now of [999,6000,Infinity,NaN])assert.equal(networkStatsFresh(1000,now),false)
    for(const last of [0,-1,NaN,Infinity])assert.equal(networkStatsFresh(last,1000),false)
    for(const value of [NaN,Infinity,-1])assert.equal(nonnegativeMetric(value),0)
    assert.equal(nonnegativeMetric(12.5),12.5)
})
test('unavailable network metrics are never shown with green healthy status',()=>{
    const f=fixture()
    try{
        f.stats._videoWidth=NaN;f.stats._videoHeight=0
        f.stats._rtt=NaN;f.stats._jitter=Infinity;f.stats._bitrate=Infinity;f.stats._packetsLost=-1
        f.overlay.createDebugOverlay()
        const labels=f.holder.children[0].children
        for(const name of ['Resolution','RTT','Jitter','Bitrate','Packets lost (total)']){
            const label=labels.find(child=>child.text().startsWith(name+':'))
            assert.equal(label?.text(),name+': Unavailable')
            assert.equal(label?.children[0].style.background,'rgb(255, 193, 7)')
        }
    }finally{f.restore()}
})
