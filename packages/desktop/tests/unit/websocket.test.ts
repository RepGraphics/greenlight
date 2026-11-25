import {test} from 'node:test'
import assert from 'node:assert/strict'
import WebsocketIPC from '../../renderer/lib/websocket'

class Socket {
    static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3
    static instances:Socket[]=[]
    readyState=Socket.CONNECTING
    sent:any[]=[]
    handlers=new Map<string,Array<(event:any)=>void>>()
    constructor(public url:string){Socket.instances.push(this)}
    addEventListener(type:string,fn:(event:any)=>void){this.handlers.set(type,[...(this.handlers.get(type)??[]),fn])}
    emit(type:string,event:any={}){for(const fn of this.handlers.get(type)??[])fn(event)}
    open(){this.readyState=Socket.OPEN;this.emit('open')}
    close(){this.readyState=Socket.CLOSED;this.emit('close')}
    send(data:string){assert.equal(this.readyState,Socket.OPEN);this.sent.push(JSON.parse(data))}
    reply(message:any){this.emit('message',{data:JSON.stringify(message)})}
}
function setup(){
    const old=Object.getOwnPropertyDescriptor(globalThis,'WebSocket')
    Socket.instances=[]
    Object.defineProperty(globalThis,'WebSocket',{value:Socket,configurable:true,writable:true})
    const ipc=new WebsocketIPC('ws://localhost/ipc')
    return {ipc,socket:Socket.instances[0],restore(){
        for(const socket of Socket.instances)socket.close()
        if(old)Object.defineProperty(globalThis,'WebSocket',old)
        else Reflect.deleteProperty(globalThis,'WebSocket')
    }}
}
test('queued WebUI requests use one open listener and resolve independently',async()=>{
    const {ipc,socket,restore}=setup()
    try{
        const first=ipc.send('streaming','getPlayerState',{})
        const second=ipc.send('settings','getSettings',{})
        assert.equal(socket.handlers.get('open')?.length,1)
        assert.equal(socket.sent.length,0)
        socket.open()
        assert.equal(socket.sent.length,2)
        socket.reply({...socket.sent[1],data:'second'})
        socket.reply({...socket.sent[0],data:'first'})
        assert.deepEqual(await Promise.all([first,second]),['first','second'])
    }finally{restore()}
})
test('closed WebUI connection rejects pending mutations without replay and reconnects on new request',async()=>{
    const {ipc,socket,restore}=setup()
    try{
        socket.open()
        const pending=ipc.send('streaming','startStream',{})
        const rejected=assert.rejects(pending,/connection closed/)
        socket.close()
        await rejected
        const next=ipc.send('streaming','getPlayerState',{})
        const replacement=Socket.instances[1]
        assert.equal(replacement.url,socket.url)
        replacement.open()
        assert.equal(replacement.sent.length,1)
        assert.equal(replacement.sent[0].action,'getPlayerState')
        socket.emit('close')
        socket.reply({...replacement.sent[0],data:'stale'})
        replacement.reply({...replacement.sent[0],data:'fresh'})
        assert.equal(await next,'fresh')
    }finally{restore()}
})
test('duplicate and mismatched WebUI replies never reach broadcast listeners',async()=>{
    const {ipc,socket,restore}=setup()
    try{
        socket.open()
        const broadcasts:any[]=[]
        ipc.onAction('streaming','getPlayerState',(_,data)=>broadcasts.push(data))
        const result=ipc.send('streaming','getPlayerState',{})
        const request=socket.sent[0]
        socket.reply({...request,channel:'settings',data:'mismatch'})
        socket.reply({...request,data:'ok'})
        assert.equal(await result,'ok')
        socket.reply({...request,data:'duplicate'})
        socket.reply({...request,id:999,data:'unknown'})
        assert.deepEqual(broadcasts,[])
        socket.reply({channel:'streaming',action:'getPlayerState',data:'event'})
        assert.deepEqual(broadcasts,['event'])
    }finally{restore()}
})
test('WebUI socket errors clear queued requests and allow fresh requests',async()=>{
    const {ipc,socket,restore}=setup()
    try{
        const pending=ipc.send('settings','getSettings',{})
        const rejected=assert.rejects(pending,/connection closed/)
        socket.emit('error')
        await rejected
        const next=ipc.send('settings','getSettings',{})
        const replacement=Socket.instances[1]
        replacement.open()
        replacement.reply({...replacement.sent[0],error:{message:'denied'}})
        await assert.rejects(next,error=>(error as any).message==='denied')
    }finally{restore()}
})
