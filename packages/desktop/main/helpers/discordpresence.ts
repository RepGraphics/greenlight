import {createConnection} from 'node:net'
import type {Socket} from 'node:net'
import {randomUUID} from 'node:crypto'
import {posix} from 'node:path'

export const discordLeaseMs=45000
const maxFrameBytes=65536
export function validDiscordApplicationId(value:unknown):value is string{
    return typeof value==='string'&&/^[1-9][0-9]{16,19}$/.test(value)
}
// Discord's documented local IPC framing; no TCP/WebSocket or token fallback.
// https://docs.discord.com/developers/topics/rpc
export function encodeDiscordFrame(opcode:number,body:Buffer|object){
    const payload=Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body),'utf8')
    if(payload.length>maxFrameBytes)throw Error('Discord RPC frame too large')
    const frame=Buffer.alloc(8+payload.length)
    frame.writeUInt32LE(opcode,0);frame.writeUInt32LE(payload.length,4);payload.copy(frame,8)
    return frame
}
export class DiscordFrameDecoder{
    private pending=Buffer.alloc(0)
    read(chunk:Buffer){
        if(chunk.length>maxFrameBytes*2||this.pending.length+chunk.length>maxFrameBytes*3)throw Error('Discord RPC buffer limit')
        this.pending=Buffer.concat([this.pending,chunk])
        const frames:Array<{opcode:number;body:Buffer}>=[]
        while(this.pending.length>=8){
            const opcode=this.pending.readUInt32LE(0),length=this.pending.readUInt32LE(4)
            if(length>maxFrameBytes||opcode>4)throw Error('Invalid Discord RPC frame')
            if(this.pending.length<8+length)break
            frames.push({opcode,body:this.pending.subarray(8,8+length)})
            this.pending=this.pending.subarray(8+length)
        }
        return frames
    }
}
export function discordActivity(type:'home'|'cloud',start:number){
    return {type:0,details:type==='home'?'Xbox Remote Play':'Xbox Cloud Gaming',state:'Streaming with Greenlight',timestamps:{start:Math.floor(start/1000)},instance:false}
}
function activityFrame(activity:ReturnType<typeof discordActivity>|null){
    return encodeDiscordFrame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity},nonce:randomUUID()})
}
export function discordSocketPaths(platform=process.platform,env=process.env){
    if(platform==='win32')return Array.from({length:10},(_,i)=>'\\\\?\\pipe\\discord-ipc-'+i)
    if(platform!=='linux'&&platform!=='darwin')return []
    const root=[env.XDG_RUNTIME_DIR,env.TMPDIR,env.TMP,env.TEMP,'/tmp'].find(value=>typeof value==='string'&&posix.isAbsolute(value))||'/tmp'
    const roots=platform==='linux'?[root,posix.join(root,'app','com.discordapp.Discord')]:[root]
    return roots.flatMap(path=>Array.from({length:10},(_,i)=>posix.join(path,'discord-ipc-'+i)))
}
async function openDiscordSocket():Promise<Socket|undefined>{
    for(const path of discordSocketPaths()){
        const socket=await new Promise<Socket|undefined>(resolve=>{
            const connection=createConnection(path)
            let settled=false
            const finish=(success:boolean)=>{
                if(settled)return
                settled=true;clearTimeout(timer)
                if(!success)connection.destroy()
                resolve(success?connection:undefined)
            }
            connection.on('error',()=>finish(false))
            connection.once('connect',()=>finish(true))
            const timer=setTimeout(()=>finish(false),300)
            timer.unref()
        })
        if(socket)return socket
    }
}
type Lease={owner:string;appId:string;type:'home'|'cloud';started:number;timer?:NodeJS.Timeout;socket?:Socket;ready:boolean;connecting:boolean;retryAt:number}
export class DiscordPresence{
    private lease:Lease|undefined
    constructor(private open:()=>Promise<Socket|undefined>=openDiscordSocket){}
    renew(owner:string,appId:string,type:'home'|'cloud'){
        if(!owner||!validDiscordApplicationId(appId)||(type!=='home'&&type!=='cloud'))return false
        let lease=this.lease
        if(!lease||lease.owner!==owner||lease.appId!==appId||lease.type!==type){
            this.release()
            lease={owner,appId,type,started:Date.now(),ready:false,connecting:false,retryAt:0}
            this.lease=lease
        }
        clearTimeout(lease.timer)
        const current=lease
        lease.timer=setTimeout(()=>{if(this.lease===current)this.release()},discordLeaseMs)
        lease.timer.unref()
        if(!lease.socket&&!lease.connecting&&Date.now()>=lease.retryAt)void this.connect(lease)
        return true
    }
    release(owner?:string){
        const lease=this.lease
        if(!lease||(owner!==undefined&&owner!==lease.owner))return
        this.lease=undefined
        clearTimeout(lease.timer)
        const socket=lease.socket
        if(!socket)return
        try{
            if(lease.ready&&!socket.destroyed){
                socket.end(activityFrame(null))
                const timeout=setTimeout(()=>socket.destroy(),500);timeout.unref()
                socket.once('close',()=>clearTimeout(timeout))
            }else socket.destroy()
        }catch{socket.destroy()}
    }
    private async connect(lease:Lease){
        lease.connecting=true
        lease.retryAt=Date.now()+15000
        let socket:Socket|undefined
        try{socket=await this.open()}catch{/* Discord is optional */}
        lease.connecting=false
        if(!socket)return
        if(this.lease!==lease){socket.destroy();return}
        if(socket.destroyed)return
        lease.socket=socket
        const decoder=new DiscordFrameDecoder()
        const handshake=setTimeout(()=>socket.destroy(),3000);handshake.unref()
        socket.on('error',()=>socket.destroy())
        socket.once('close',()=>{
            clearTimeout(handshake)
            if(lease.socket===socket){lease.socket=undefined;lease.ready=false}
        })
        socket.on('data',(chunk:Buffer)=>{
            if(this.lease!==lease||lease.socket!==socket)return
            try{
                for(const frame of decoder.read(chunk)){
                    if(frame.opcode===2){socket.destroy();return}
                    if(frame.opcode===3){socket.write(encodeDiscordFrame(4,frame.body));continue}
                    if(frame.opcode!==1)continue
                    const message=JSON.parse(frame.body.toString('utf8'))
                    if(message?.evt==='ERROR'){socket.destroy();return}
                    if(!lease.ready&&message?.cmd==='DISPATCH'&&message?.evt==='READY'){
                        clearTimeout(handshake);lease.ready=true
                        socket.write(activityFrame(discordActivity(lease.type,lease.started)))
                    }
                }
            }catch{socket.destroy()}
        })
        try{socket.write(encodeDiscordFrame(0,{v:1,client_id:lease.appId}))}catch{socket.destroy()}
    }
}
