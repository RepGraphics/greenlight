import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ClassicPrimaryInput,installClassicInputLifecycle,classicVirtualPad} from '../../renderer/lib/classicinputlifecycle'

test('Classic keeps a selected physical controller and normalizes the virtual slot',()=>{
    const input=new ClassicPrimaryInput()
    assert.deepEqual(input.read([{GamepadIndex:5,A:1}]),[{GamepadIndex:0,A:1}])
    assert.deepEqual(input.read([{GamepadIndex:0,A:0},{GamepadIndex:5,A:1}]),[{GamepadIndex:0,A:1}])
    const neutral=input.read([{GamepadIndex:0,A:1}])[0]
    assert.equal(neutral.GamepadIndex,0);assert.equal(neutral.A,0);assert.equal(neutral.LeftThumbXAxis,0)
    assert.deepEqual(input.read([{GamepadIndex:0,A:1}]),[{GamepadIndex:0,A:1}])
    assert.equal(input.read([])[0].A,0);assert.deepEqual(input.read([]),[])
})
test('Classic rejects invalid physical indices and resets on a new lifecycle',()=>{
    const input=new ClassicPrimaryInput()
    assert.deepEqual(input.read([{GamepadIndex:NaN,A:1},{GamepadIndex:-1,A:1}]),[])
    input.read([{GamepadIndex:5,A:1}]);input.reset()
    assert.deepEqual(input.read([{GamepadIndex:2,A:1}]),[{GamepadIndex:0,A:1}])
})
function fixture(){
    let next=0,stops=0,queueLength=0,frames=[{GamepadIndex:4,A:1}]
    const timers=new Map<number,()=>void>(),sent:Array<Array<Record<string,number>>>=[]
    const channel={_state:'connected',getGamepadQueueLength:()=>queueLength,queueGamepadStates:(states:Array<Record<string,number>>)=>sent.push(states)}
    const driver={requestStates:()=>frames,run:()=>assert.fail('upstream loop'),stop:()=>{stops++},_application:{getChannelProcessor:()=>channel}}
    const schedule=((callback:()=>void)=>{timers.set(++next,callback);return next}) as unknown as typeof setTimeout
    const cancel=((id:number)=>timers.delete(id)) as unknown as typeof clearTimeout
    assert.equal(installClassicInputLifecycle(driver,schedule,cancel),true)
    return {driver,timers,sent,channel,get stops(){return stops},setFrames(value:typeof frames){frames=value},setQueue(n:number){queueLength=n},tick(){const entry=timers.entries().next().value;if(!entry)throw Error('No timer');timers.delete(entry[0]);entry[1]()}}
}
test('Classic input polling is idempotent and stops even if a stale callback fires',()=>{
    const f=fixture()
    f.driver.run();f.driver.run()
    assert.equal(f.timers.size,1);assert.equal(f.sent.length,1)
    const old=[...f.timers.values()][0]
    f.driver.stop();old()
    assert.equal(f.stops,1);assert.equal(f.timers.size,0);assert.equal(f.sent.length,1)
    assert.equal(installClassicInputLifecycle(f.driver),false)
})
test('Classic polling retains disconnect neutral state under backpressure',()=>{
    const f=fixture()
    f.driver.run();f.setFrames([{GamepadIndex:1,A:1}]);f.setQueue(10);f.tick()
    assert.equal(f.sent.length,1)
    f.setQueue(0);f.tick();assert.equal(f.sent.at(-1)?.[0].A,0)
    f.tick();assert.equal(f.sent.at(-1)?.[0].A,1)
    f.channel._state='closed';f.tick();assert.equal(f.timers.size,0)
})

test('a stale callback cannot send frames or orphan the timer of a restarted Classic driver',()=>{
    const f=fixture()
    f.driver.run()
    const stale=[...f.timers.values()][0]
    f.driver.stop()
    f.setFrames([{GamepadIndex:2,A:0}])
    f.driver.run()
    const active=[...f.timers.keys()][0]
    const sent=f.sent.length
    stale()
    assert.equal(f.sent.length,sent)
    assert.deepEqual([...f.timers.keys()],[active])
    f.tick()
    assert.equal(f.sent.length,sent+1)
    assert.equal(f.timers.size,1)
    f.driver.stop()
    assert.equal(f.timers.size,0)
})
test('a stopped channel cannot revive an old polling generation after reopening',()=>{
    const f=fixture()
    f.driver.run()
    const stale=[...f.timers.values()][0]
    f.channel._state='closed';f.tick()
    assert.equal(f.timers.size,0)
    f.channel._state='connected';f.driver.run()
    const sent=f.sent.length
    stale()
    assert.equal(f.sent.length,sent)
    assert.equal(f.timers.size,1)
    f.driver.stop()
    assert.equal(f.timers.size,0)
})

test('Classic virtual buttons merge into one slot, retaining physical buttons after release',()=>{
    const f=fixture(),pad=classicVirtualPad(f.driver)!
    f.setFrames([{GamepadIndex:4,A:1}]);f.driver.run()
    pad.press(1,'B');f.tick();assert.equal(f.sent.at(-1)?.[0].B,1);assert.equal(f.sent.at(-1)?.[0].A,1)
    pad.release(1);f.tick();assert.equal(f.sent.at(-1)?.[0].B,0);assert.equal(f.sent.at(-1)?.[0].A,1)
    f.driver.stop()
})
test('Classic touch-only input sends an explicit neutral frame after release even under backpressure',()=>{
    const f=fixture(),pad=classicVirtualPad(f.driver)!
    f.setFrames([]);f.driver.run();assert.equal(f.sent.length,0)
    pad.press(1,'A');pad.press(2,'A');f.tick();assert.equal(f.sent.at(-1)?.[0].A,1)
    pad.release(1);f.tick();assert.equal(f.sent.at(-1)?.[0].A,1)
    pad.release(2);f.setQueue(10);f.tick();assert.equal(f.sent.at(-1)?.[0].A,1)
    f.setQueue(0);f.tick();assert.equal(f.sent.at(-1)?.[0].A,0)
    const count=f.sent.length;f.tick();assert.equal(f.sent.length,count)
    f.driver.stop()
})
test('Classic stick ownership is independent, bounded and reset on stop',()=>{
    const f=fixture(),pad=classicVirtualPad(f.driver)!
    f.setFrames([]);f.driver.run()
    assert.equal(pad.move('Left',1,1,1),true);assert.equal(pad.move('Left',2,0,0),false)
    pad.move('Right',3,0,-1);f.tick()
    const frame=f.sent.at(-1)![0];assert.ok(Math.abs(frame.LeftThumbXAxis-Math.SQRT1_2)<0.001);assert.ok(frame.LeftThumbYAxis<0);assert.equal(frame.RightThumbYAxis,1)
    pad.releaseStick('Left',2);f.tick();assert.ok(f.sent.at(-1)![0].LeftThumbXAxis>0)
    pad.releaseAll();f.tick();assert.equal(f.sent.at(-1)![0].LeftThumbXAxis,0);assert.equal(f.sent.at(-1)![0].RightThumbYAxis,0)
    pad.press(4,'B');f.driver.stop();f.driver.run();assert.deepEqual(f.driver.requestStates(),[])
    f.driver.stop()
})
