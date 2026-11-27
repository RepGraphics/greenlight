import {test} from 'node:test'
import assert from 'node:assert/strict'
import {SessionLifecycle} from '../../renderer/lib/sessionlifecycle'

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function deferred<T>(){
    let resolve!:(value:T)=>void,reject!:(error:Error)=>void
    const promise=new Promise<T>((ok,fail)=>{resolve=ok;reject=fail})
    return {promise,resolve,reject}
}
function fixture(){
    const callbacks=new Map<number,()=>void>()
    let id=0
    const lifecycle=new SessionLifecycle(((fn:()=>void)=>{callbacks.set(++id,fn);return id}) as unknown as typeof setTimeout,((timer:number)=>callbacks.delete(timer)) as unknown as typeof clearTimeout)
    return {lifecycle,callbacks,expire(){const list=[...callbacks.values()];callbacks.clear();list.forEach(fn=>fn())}}
}
test('default session timers use the browser global receiver during start and teardown',async t=>{
    let timer=0
    const cleared:number[]=[]
    t.mock.method(globalThis,'setTimeout',function(this:unknown){
        assert.equal(this,globalThis)
        return ++timer
    })
    t.mock.method(globalThis,'clearTimeout',function(this:unknown,id:number){
        assert.equal(this,globalThis)
        cleared.push(id)
    })
    const lifecycle=new SessionLifecycle()
    const calls:string[]=[]
    lifecycle.begin({
        start:async()=>{calls.push('start');return 'session'},
        stop:async id=>{calls.push('stop-'+id)},
        onSession:id=>calls.push('ready-'+id),
        onError:()=>assert.fail('unexpected session failure'),
    })
    await flush()
    assert.deepEqual(calls,['start','ready-session'])
    assert.equal(await lifecycle.end(),true)
    assert.deepEqual(calls,['start','ready-session','stop-session'])
    assert.deepEqual(cleared,[1,2])
})
test('replacement waits for slow cancelled provisioning and teardown',async()=>{
    const {lifecycle}=fixture(),pending=deferred<string>(),closing=deferred<void>()
    const calls:string[]=[]
    const stopFirst=lifecycle.begin({start:()=>{calls.push('start-old');return pending.promise},stop:id=>{calls.push('stop-'+id);return closing.promise},onSession:()=>assert.fail('late session'),onError:()=>assert.fail('unexpected error')})
    await flush();stopFirst()
    const stopSecond=lifecycle.begin({start:async()=>{calls.push('start-new');return 'new'},stop:async id=>{calls.push('stop-'+id)},onSession:id=>calls.push('ready-'+id),onError:()=>assert.fail('unexpected error')})
    await flush();assert.deepEqual(calls,['start-old'])
    pending.resolve('old');await flush()
    assert.deepEqual(calls,['start-old','stop-old'])
    closing.resolve();await flush()
    assert.deepEqual(calls,['start-old','stop-old','start-new','ready-new'])
    stopSecond();await flush();assert.equal(calls.at(-1),'stop-new')
})
test('failed stop blocks replacement and retains the old session for manual retry',async()=>{
    const {lifecycle}=fixture()
    let stops=0,starts=0
    const errors:string[]=[]
    const first=lifecycle.begin({start:async()=> 'old',stop:async()=>{if(++stops<=2)throw Error('offline')},onSession:()=>{},onError:reason=>errors.push(reason)})
    await flush();first();await flush()
    const second=lifecycle.begin({start:async()=>{starts++;return 'new'},stop:async()=>{},onSession:()=>{},onError:reason=>errors.push(reason)})
    await flush();assert.equal(starts,0);assert.deepEqual(errors,['stop'])
    second()
    const third=lifecycle.begin({start:async()=>{starts++;return 'new'},stop:async()=>{},onSession:()=>{},onError:reason=>errors.push(reason)})
    await flush();assert.equal(starts,1);assert.equal(stops,3)
    third();await flush()
})
test('timed-out provisioning is cleaned up on late success without delivering the session',async()=>{
    const {lifecycle,expire,callbacks}=fixture(),pending=deferred<string>()
    const errors:string[]=[],stopped:string[]=[]
    const dispose=lifecycle.begin({start:()=>pending.promise,stop:async id=>{stopped.push(id)},onSession:()=>assert.fail('late session'),onError:reason=>errors.push(reason)})
    await flush();expire();assert.deepEqual(errors,['start'])
    pending.resolve('late');await flush()
    assert.deepEqual(stopped,['late']);assert.equal(callbacks.size,0)
    dispose();await flush();assert.deepEqual(stopped,['late'])
})
test('disposing a queued attempt skips provisioning',async()=>{
    const {lifecycle}=fixture()
    const stop=lifecycle.begin({start:async()=>assert.fail('cancelled start'),stop:async()=>assert.fail('unexpected stop'),onSession:()=>assert.fail('unexpected session'),onError:()=>assert.fail('unexpected error')})
    stop();await flush()
})
test('failed or invalid provisioning permits a subsequent attempt',async()=>{
    const {lifecycle,callbacks}=fixture(),errors:string[]=[]
    for(const start of [async()=>{throw Error('offline')},async()=>null]){
        const dispose=lifecycle.begin({start,stop:async()=>{},onSession:()=>assert.fail('invalid session'),onError:reason=>errors.push(reason)})
        await flush();dispose()
    }
    const ready:string[]=[]
    const dispose=lifecycle.begin({start:async()=> 'valid',stop:async()=>{},onSession:id=>ready.push(id),onError:()=>assert.fail('unexpected failure')})
    await flush();assert.deepEqual(errors,['start','start']);assert.deepEqual(ready,['valid']);assert.equal(callbacks.size,0)
    dispose();await flush()
})

test('explicit end waits for late provisioning and acknowledged teardown, sharing concurrent exit requests',async()=>{
    const {lifecycle,callbacks}=fixture(),pending=deferred<string>(),closing=deferred<void>()
    const calls:string[]=[]
    const dispose=lifecycle.begin({start:()=>pending.promise,stop:id=>{calls.push(id);return closing.promise},onSession:()=>assert.fail('late session'),onError:()=>assert.fail('unexpected error')})
    await flush()
    const end=lifecycle.end();assert.equal(lifecycle.end(),end)
    let done=false;void end.then(()=>{done=true})
    await flush();assert.equal(done,false);assert.equal(callbacks.size,1)
    pending.resolve('late');await flush();assert.deepEqual(calls,['late']);assert.equal(done,false)
    dispose();closing.resolve();assert.equal(await end,true);await flush();assert.deepEqual(calls,['late'])
})
test('explicit exit retains a failed stop and reports success only on a later acknowledgement',async()=>{
    const {lifecycle}=fixture()
    let stops=0
    const dispose=lifecycle.begin({start:async()=> 'owned',stop:async id=>{assert.equal(id,'owned');if(++stops===1)throw Error('offline')},onSession:()=>{},onError:()=>assert.fail('unexpected error')})
    await flush()
    assert.equal(await lifecycle.end(),false);assert.equal(stops,1)
    assert.equal(await lifecycle.end(),true);assert.equal(stops,2)
    dispose();await flush();assert.equal(stops,2)
})
test('explicit exit skips queued provisioning without calling stop',async()=>{
    const {lifecycle}=fixture()
    const dispose=lifecycle.begin({start:async()=>assert.fail('cancelled start'),stop:async()=>assert.fail('unexpected stop'),onSession:()=>assert.fail('unexpected session'),onError:()=>assert.fail('unexpected error')})
    assert.equal(await lifecycle.end(),true);dispose();await flush()
})
test('explicit exit after provisioning failure succeeds without a remote session',async()=>{
    const {lifecycle}=fixture()
    const dispose=lifecycle.begin({start:async()=>{throw Error('offline')},stop:async()=>assert.fail('unexpected stop'),onSession:()=>assert.fail('unexpected session'),onError:()=>{}})
    await flush();assert.equal(await lifecycle.end(),true);dispose();await flush()
})

test('Classic retry after a start timeout cannot provision until the late session is stopped',async()=>{
    const {lifecycle,expire}=fixture(),pending=deferred<string>(),closing=deferred<void>()
    const calls:string[]=[]
    lifecycle.begin({start:()=>pending.promise,stop:id=>{calls.push('stop-'+id);return closing.promise},onSession:()=>assert.fail('expired session'),onError:reason=>calls.push(reason)})
    await flush();expire()
    const retry=lifecycle.end().then(stopped=>{assert.equal(stopped,true);return lifecycle.begin({start:async()=>{calls.push('start-replacement');return 'replacement'},stop:async()=>{},onSession:id=>calls.push(id),onError:()=>assert.fail('replacement failure')})})
    await flush();assert.deepEqual(calls,['start'])
    pending.resolve('expired');await flush();assert.deepEqual(calls,['start','stop-expired'])
    closing.resolve();const dispose=await retry;await flush()
    assert.deepEqual(calls,['start','stop-expired','start-replacement','replacement']);dispose();await flush()
})
test('Classic explicit exit after failed remote teardown cannot silently release ownership',async()=>{
    const {lifecycle}=fixture()
    let stops=0
    const pending=deferred<string>()
    lifecycle.begin({start:()=>pending.promise,stop:async id=>{assert.equal(id,'late');if(++stops===1)throw Error('offline')},onSession:()=>assert.fail('cancelled session'),onError:()=>assert.fail('unexpected failure')})
    await flush()
    const exit=lifecycle.end();pending.resolve('late');assert.equal(await exit,false);assert.equal(stops,1)
    assert.equal(await lifecycle.end(),true);assert.equal(stops,2)
})

test('exit timeout reports failure while slow provisioning remains owned and retry shares cleanup',async()=>{
    const {lifecycle,expire,callbacks}=fixture(),pending=deferred<string>(),closing=deferred<void>()
    const calls:string[]=[]
    lifecycle.begin({start:()=>pending.promise,stop:id=>{calls.push(id);return closing.promise},onSession:()=>assert.fail('late session'),onError:()=>assert.fail('cancelled session')})
    await flush()
    const first=lifecycle.end()
    expire();assert.equal(await first,false)
    const retry=lifecycle.end()
    assert.equal(lifecycle.end(),retry)
    pending.resolve('late');await flush()
    assert.deepEqual(calls,['late'])
    closing.resolve();assert.equal(await retry,true)
    assert.equal(callbacks.size,0);assert.deepEqual(calls,['late'])
})
test('timed-out stop keeps replacement behind the actual cleanup operation',async()=>{
    const {lifecycle,expire}=fixture(),closing=deferred<void>()
    const calls:string[]=[]
    lifecycle.begin({start:async()=> 'old',stop:id=>{calls.push('stop-'+id);return closing.promise},onSession:()=>{},onError:()=>assert.fail('unexpected failure')})
    await flush()
    const end=lifecycle.end();await flush()
    expire();assert.equal(await end,false)
    const dispose=lifecycle.begin({start:async()=>{calls.push('start-new');return 'new'},stop:async id=>{calls.push('stop-'+id)},onSession:id=>calls.push('ready-'+id),onError:()=>assert.fail('unexpected failure')})
    await flush();assert.deepEqual(calls,['stop-old'])
    closing.resolve();await flush()
    assert.deepEqual(calls,['stop-old','start-new','ready-new'])
    dispose();await flush();assert.equal(calls.at(-1),'stop-new')
})
test('late failed stop retains ownership after UI timeout for explicit retry',async()=>{
    const {lifecycle,expire,callbacks}=fixture(),closing=deferred<void>()
    let stops=0
    lifecycle.begin({start:async()=> 'owned',stop:async id=>{assert.equal(id,'owned');if(++stops===1)await closing.promise},onSession:()=>{},onError:()=>assert.fail('unexpected failure')})
    await flush()
    const end=lifecycle.end();await flush()
    expire();assert.equal(await end,false)
    closing.reject(Error('offline'));await flush()
    assert.equal(await lifecycle.end(),true);assert.equal(stops,2)
    assert.equal(callbacks.size,0)
})
test('late successful cleanup needs no additional stop after the UI timed out',async()=>{
    const {lifecycle,expire,callbacks}=fixture(),closing=deferred<void>()
    let stops=0
    lifecycle.begin({start:async()=> 'owned',stop:()=>{stops++;return closing.promise},onSession:()=>{},onError:()=>assert.fail('unexpected failure')})
    await flush()
    const end=lifecycle.end();await flush()
    expire();assert.equal(await end,false)
    closing.resolve();await flush()
    assert.equal(await lifecycle.end(),true);assert.equal(stops,1)
    assert.equal(callbacks.size,0)
})

test('a replacement queued behind a stalled stop times out without starting another session',async()=>{
    const {lifecycle,expire,callbacks}=fixture(),closing=deferred<void>()
    const calls:string[]=[]
    const first=lifecycle.begin({start:async()=> 'old',stop:()=>{calls.push('stop-old');return closing.promise},onSession:()=>{},onError:()=>assert.fail('unexpected error')})
    await flush();first();await flush()
    const second=lifecycle.begin({start:async()=>{calls.push('start-new');return 'new'},stop:async()=>{},onSession:()=>assert.fail('expired replacement'),onError:reason=>calls.push(reason)})
    await flush();assert.deepEqual(calls,['stop-old'])
    expire();assert.deepEqual(calls,['stop-old','stop'])
    closing.resolve();await flush()
    assert.deepEqual(calls,['stop-old','stop'])
    assert.equal(callbacks.size,0)
    second()
    assert.equal(await lifecycle.end(),true)
})
test('a queued replacement cannot overtake timed-out provisioning, even after its own deadline',async()=>{
    const {lifecycle,expire}=fixture(),pending=deferred<string>()
    const calls:string[]=[]
    const first=lifecycle.begin({start:()=>pending.promise,stop:async id=>{calls.push('stop-'+id)},onSession:()=>assert.fail('late old session'),onError:reason=>calls.push(reason)})
    await flush();first()
    lifecycle.begin({start:async()=>{calls.push('start-new');return 'new'},stop:async()=>{},onSession:()=>assert.fail('expired new session'),onError:reason=>calls.push(reason)})
    expire();assert.deepEqual(calls,['stop'])
    pending.resolve('old');await flush()
    assert.deepEqual(calls,['stop','stop-old'])
    assert.equal(await lifecycle.end(),true)
})
test('failed previous teardown clears the replacement deadline and preserves ownership',async()=>{
    const {lifecycle,callbacks,expire}=fixture()
    const errors:string[]=[]
    let stops=0
    lifecycle.begin({start:async()=> 'old',stop:async()=>{if(++stops===1)throw Error('offline')},onSession:()=>{},onError:()=>assert.fail('unexpected error')})
    await flush()
    const second=lifecycle.begin({start:async()=>assert.fail('unsafe start'),stop:async()=>{},onSession:()=>assert.fail('unsafe session'),onError:reason=>errors.push(reason)})
    await flush()
    assert.deepEqual(errors,['stop']);assert.equal(callbacks.size,0)
    expire();assert.deepEqual(errors,['stop'])
    second();assert.equal(await lifecycle.end(),true);assert.equal(stops,2)
})
