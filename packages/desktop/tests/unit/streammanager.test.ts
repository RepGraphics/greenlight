import {test} from 'node:test'
import assert from 'node:assert/strict'
import StreamManager from '../../main/helpers/streammanager'
function fixture(){
    const calls:any[]=[]
    const api=(type:string)=>({startStream:async(target:string,resolution:number)=>{calls.push([type,'start',target,resolution]);return {sessionPath:'/v5/sessions/'+type+'-id'}},sendKeepalive:async(id:string)=>{calls.push([type,'heartbeat',id]);return true},stopStream:async(id:string)=>{calls.push([type,'stop',id]);return true}})
    const manager=new StreamManager({_xHomeApi:api('home'),_xCloudApi:api('cloud')})
    manager.monitorSession=()=>{}
    return {manager,calls}
}
test('session manager routes home and cloud sessions to the correct API',async()=>{const {manager,calls}=fixture();const home=await manager.startStream('home','console',720) as string;const cloud=await manager.startStream('cloud','title',1080) as string;await manager.sendKeepalive(home);await manager.sendKeepalive(cloud);await manager.stopStream(home);assert.equal(manager.getSession(home),undefined);assert.equal(manager.getSession(cloud).type,'cloud');assert.deepEqual(calls,[['home','start','console',720],['cloud','start','title',1080],['home','heartbeat',home],['cloud','heartbeat',cloud],['home','stop',home]])})
test('session manager rejects missing or inherited session identifiers',async()=>{const {manager,calls}=fixture();for(const id of ['__proto__','constructor','toString','missing']){assert.equal(manager.getSession(id),undefined);await assert.rejects(manager.sendKeepalive(id));await manager.stopStream(id)}await assert.rejects(manager.startStream('invalid','title'));assert.equal(calls.length,0)})
test('invalid server session response fails without creating a session',async()=>{const manager=new StreamManager({_xHomeApi:{startStream:async()=>({sessionPath:'/v5/sessions/__proto__'})}});await assert.rejects(manager.startStream('home','console'));assert.equal(Object.keys(manager._sessions).length,0)})
