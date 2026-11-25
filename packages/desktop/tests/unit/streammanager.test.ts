import {test} from 'node:test'
import assert from 'node:assert/strict'
import StreamManager,{homeProvisioningDeadlineMs,cloudProvisioningDeadlineMs} from '../../main/helpers/streammanager'
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

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function monitorFixture(states:Array<unknown>){
    let timer=0
    const callbacks=new Map<number,()=>void>(),deadlines=new Map<number,()=>void>()
    const durations:number[]=[]
    const calls:string[]=[]
    const api={startStream:async()=>({sessionPath:'/v5/sessions/monitor-id'}),getStreamState:async()=>{calls.push('poll');const next=states.shift();if(next instanceof Error)throw next;return next},getWaitingTimes:async()=>({estimatedTotalWaitTimeInSeconds:10}),sendMSALAuth:async()=>{calls.push('auth')},stopStream:async()=>{calls.push('stop');return true}}
    const manager=new StreamManager({_xHomeApi:api,_xCloudApi:api,_authentication:{_msal:{getMsalToken:async()=>({data:{lpt:'mock'}})}}},((cb:()=>void,delay:number)=>{const id=++timer;if(delay===1000)callbacks.set(id,cb);else{durations.push(delay);deadlines.set(id,cb)}return id}) as unknown as typeof setTimeout,((id:number)=>{callbacks.delete(id);deadlines.delete(id)}) as unknown as typeof clearTimeout)
    return {manager,calls,callbacks,deadlines,durations,api,expire(){const entry=deadlines.entries().next().value;if(!entry)throw Error('No provisioning deadline');deadlines.delete(entry[0]);entry[1]()},async tick(){const entry=callbacks.entries().next().value;if(!entry)throw Error('No poll scheduled');callbacks.delete(entry[0]);entry[1]();await flush()}}
}
test('monitor polls once per interval and stops after provisioning',async()=>{const f=monitorFixture([{state:'WaitingForResources'},{state:'ReadyToConnect'},{state:'Provisioned'}]);const id=await f.manager.startStream('home','console') as string;f.manager.monitorSession(id);assert.equal(f.callbacks.size,1);await f.tick();assert.equal(f.manager.getSession(id).playerState,'queued');await f.tick();assert.ok(f.calls.includes('auth'));await f.tick();assert.equal(f.manager.getSession(id).playerState,'started');assert.equal(f.callbacks.size,0)})
test('monitor terminates after five consecutive API failures',async()=>{const f=monitorFixture(Array.from({length:5},()=>Error('offline')));const id=await f.manager.startStream('home','console') as string;for(let i=0;i<5;i++)await f.tick();assert.equal(f.manager.getSession(id).playerState,'failed');assert.equal(f.callbacks.size,0)})
test('monitor terminates immediately for missing session',async()=>{const f=monitorFixture([Object.assign(Error('missing'),{status:404})]);const id=await f.manager.startStream('home','console') as string;await f.tick();assert.equal(f.manager.getSession(id).errorDetails?.code,'StreamStateUnavailable');assert.equal(f.callbacks.size,0)})
test('parallel stop requests share one operation and cancel pending monitoring',async()=>{const f=monitorFixture([]);const id=await f.manager.startStream('home','console') as string;const first=f.manager.stopStream(id);const second=f.manager.stopStream(id);assert.equal(first,second);await Promise.all([first,second]);assert.deepEqual(f.calls,['stop']);assert.equal(f.callbacks.size,0);assert.equal(f.manager.getSession(id),undefined)})

test('already expired remote sessions are treated as stopped for either engine',async()=>{
    for(const type of ['home','cloud']){
        for(const status of [404,410]){
            const {manager}=fixture()
            const id=await manager.startStream(type,'target') as string
            let stops=0
            manager.getApi=()=>({stopStream:async()=>{stops++;throw {status}}}) as any
            assert.equal(await manager.stopStream(id),true)
            assert.equal(manager.getSession(id),undefined)
            assert.equal(await manager.stopStream(id),true)
            assert.equal(stops,1)
        }
    }
})
test('failed remote stops retain session ownership and can be retried',async()=>{
    for(const status of [401,403,429,500]){
        const {manager}=fixture()
        const id=await manager.startStream('home','console') as string
        let stops=0
        manager.getApi=()=>({stopStream:async()=>{if(++stops===1)throw {status};return true}}) as any
        await assert.rejects(manager.stopStream(id),error=>(error as {status:number}).status===status)
        assert.ok(manager.getSession(id))
        assert.equal(await manager.stopStream(id),true)
        assert.equal(manager.getSession(id),undefined)
        assert.equal(stops,2)
    }
})

test('shared provisioning deadlines distinguish Remote Play and cloud queues and retain ownership',async()=>{
    for(const [type,deadline] of [['home',homeProvisioningDeadlineMs],['cloud',cloudProvisioningDeadlineMs]] as const){
        const f=monitorFixture([{state:'WaitingForResources'},{state:'WaitingForResources'}])
        const id=await f.manager.startStream(type,'target') as string
        assert.deepEqual(f.durations,[deadline]);await f.tick();await f.tick()
        assert.deepEqual(f.durations,[deadline]);assert.equal(f.manager.getSession(id).playerState,'queued')
        f.expire();assert.equal(f.manager.getSession(id).errorDetails?.code,'StreamProvisioningTimeout')
        assert.equal(f.manager.getSession(id).playerState,'failed');assert.equal(f.callbacks.size,0);assert.equal(f.deadlines.size,0)
        await f.manager.stopStream(id);assert.equal(f.manager.getSession(id),undefined)
    }
})
test('deadline can expire during unresolved MSAL acquisition and late token cannot be sent',async()=>{
    const f=monitorFixture([{state:'ReadyToConnect'}])
    let finish!:(value:any)=>void
    f.manager._application._authentication._msal.getMsalToken=(()=>new Promise(done=>{finish=done})) as any
    const id=await f.manager.startStream('home','console') as string
    await f.tick();f.expire();assert.equal(f.manager.getSession(id).playerState,'failed')
    finish({data:{lpt:'mock'}});await flush()
    assert.deepEqual(f.calls,['poll']);assert.equal(f.callbacks.size,0)
    await f.manager.stopStream(id)
})
test('late Provisioned response cannot revive an expired attempt',async()=>{
    const f=monitorFixture([])
    let finish!:(value:any)=>void
    f.api.getStreamState=()=>new Promise(done=>{finish=done})
    const id=await f.manager.startStream('home','console') as string
    await f.tick();f.expire();finish({state:'Provisioned'});await flush()
    assert.equal(f.manager.getSession(id).playerState,'failed');assert.equal(f.callbacks.size,0)
    await f.manager.stopStream(id)
})
test('successful authentication is sent once during repeated ReadyToConnect states',async()=>{
    const f=monitorFixture([{state:'ReadyToConnect'},{state:'ReadyToConnect'},{state:'Provisioned'}])
    const id=await f.manager.startStream('home','console') as string
    for(let i=0;i<3;i++)await f.tick()
    assert.deepEqual(f.calls,['poll','auth','poll','poll'])
    assert.equal(f.manager.getSession(id).playerState,'started');assert.equal(f.deadlines.size,0);assert.equal(f.callbacks.size,0)
})
test('stop acknowledgement cancels both timers and stale callbacks cannot change session state',async()=>{
    const f=monitorFixture([]),id=await f.manager.startStream('home','console') as string
    const oldDeadline=[...f.deadlines.values()][0],oldPoll=[...f.callbacks.values()][0]
    await f.manager.stopStream(id);assert.equal(f.deadlines.size,0);assert.equal(f.callbacks.size,0)
    const next=await f.manager.startStream('home','console') as string
    assert.equal(id,next);oldDeadline();oldPoll();await flush()
    assert.equal(f.manager.getSession(next).playerState,'pending');assert.equal(f.callbacks.size,1);assert.equal(f.deadlines.size,1)
    await f.manager.stopStream(next)
})
test('HTTP 410 is terminal during provisioning',async()=>{
    const f=monitorFixture([Object.assign(Error('expired'),{status:410})]),id=await f.manager.startStream('home','console') as string
    await f.tick();assert.equal(f.manager.getSession(id).errorDetails?.code,'StreamStateUnavailable')
    assert.equal(f.deadlines.size,0);assert.equal(f.callbacks.size,0)
})
