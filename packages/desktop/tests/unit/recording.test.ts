import {test} from 'node:test'
import assert from 'node:assert/strict'
import {cloneRemoteMedia,startStreamRecording,recordingLimitBytes,recordingStopThresholdBytes,recordingOptions} from '../../renderer/lib/streamrecording'
import {startInstantReplay} from '../../renderer/lib/instantreplay'
class Track {readyState='live';stopped=false;copies:Track[]=[];clone(){const track=new Track();this.copies.push(track);return track}stop(){this.stopped=true;this.readyState='ended'}}
class Stream {constructor(private tracks:Track[]){}getVideoTracks(){return this.tracks}getAudioTracks():Track[]{return []}}
class Recorder {
    static all:Recorder[]=[]
    static isTypeSupported(){return true}
    state='inactive'
    ondataavailable:((event:{data:Blob})=>void)|null=null
    onstop:(()=>void)|null=null
    onerror:(()=>void)|null=null
    constructor(_stream?:unknown,public options?:MediaRecorderOptions){Recorder.all.push(this)}
    start(){this.state='recording'}
    stop(){this.state='inactive'}
    data(blob:Blob){this.ondataavailable?.({data:blob})}
    finish(){this.state='inactive';this.onstop?.()}
}
function setup(){
    Recorder.all=[]
    const old=new Map<string,PropertyDescriptor|undefined>()
    for(const [key,value] of Object.entries({MediaRecorder:Recorder,MediaStream:Stream,document:{querySelector:()=>null}})){old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})}
    const source=new Track()
    return {source,video:{srcObject:new Stream([source])} as unknown as HTMLVideoElement,restore(){for(const [key,value] of old){if(value)Object.defineProperty(globalThis,key,value);else delete (globalThis as any)[key]}}}
}
test('recording waits for final data and stops only cloned tracks',()=>{const {source,video,restore}=setup();try{const results:any[]=[];const recording=startStreamRecording(video,(blob,error)=>results.push({blob,error}));const recorder=Recorder.all[0];recorder.data(new Blob(['first']));recording.stop();recording.stop();assert.equal(results.length,0);recorder.data(new Blob(['last']));recorder.finish();recorder.finish();assert.equal(results.length,1);assert.equal(results[0].blob.size,9);assert.equal(results[0].error,false);assert.equal(source.stopped,false);assert.equal(source.copies[0].stopped,true)}finally{restore()}})
test('recording rejects chunks beyond its memory cap',()=>{const {video,restore}=setup();try{const results:any[]=[];startStreamRecording(video,(blob,error)=>results.push({blob,error}));const recorder=Recorder.all[0];recorder.data({size:recordingLimitBytes+1} as Blob);recorder.data(new Blob(['late']));recorder.finish();assert.deepEqual(results,[{blob:null,error:true}])}finally{restore()}})
test('instant replay saves a finalized segment and cleans up cloned tracks',async()=>{const {source,video,restore}=setup();let replay:ReturnType<typeof startInstantReplay>|undefined;try{replay=startInstantReplay(video,()=>{},()=>assert.fail('unexpected error'));const recorder=Recorder.all[0];recorder.data(new Blob(['video']));const saved=replay.save();recorder.finish();const blob=await saved;assert.equal(blob?.size,5);assert.equal(Recorder.all.length,2);replay.dispose();assert.equal(source.stopped,false);assert.equal(source.copies[0].stopped,true);assert.equal(await replay.save(),null)}finally{replay?.dispose();restore()}})
test('disposing replay resolves a pending save without preserving an incomplete clip',async()=>{const {video,restore}=setup();let replay:ReturnType<typeof startInstantReplay>|undefined;try{replay=startInstantReplay(video,()=>{},()=>{});const pending=replay.save();replay.dispose();assert.equal(await pending,null)}finally{replay?.dispose();restore()}})

test('Classic recording clones explicit remote audio rather than looking up an unrelated element',()=>{const {source,video,restore}=setup();try{const audio=new Track();const remote={srcObject:{}};remote.srcObject=new (globalThis as any).MediaStream([]);(remote.srcObject as any).getAudioTracks=()=>[audio];const results:any[]=[];const recording=startStreamRecording(video,(blob,error)=>results.push({blob,error}),remote as HTMLAudioElement);assert.equal(audio.copies.length,1);recording.stop();Recorder.all[0].finish();assert.equal(audio.stopped,false);assert.equal(audio.copies[0].stopped,true);assert.equal(source.copies[0].stopped,true)}finally{restore()}})
test('Classic replay clones explicit remote audio and releases the clones',()=>{const {video,restore}=setup();try{const audio=new Track();const remote={srcObject:new (globalThis as any).MediaStream([])};remote.srcObject.getAudioTracks=()=>[audio];const replay=startInstantReplay(video,()=>{},()=>assert.fail('unexpected failure'),15,remote as HTMLAudioElement);assert.equal(audio.copies.length,1);replay.dispose();assert.equal(audio.stopped,false);assert.equal(audio.copies[0].stopped,true)}finally{restore()}})

test('both capture modes include live audio multiplexed with video',()=>{
    const {source,video,restore}=setup()
    const audio=new Track()
    ;(video.srcObject as unknown as Stream).getAudioTracks=()=>[audio]
    try{
        const recording=startStreamRecording(video,()=>{},null)
        recording.stop();Recorder.all[0].finish()
        const replay=startInstantReplay(video,()=>{},()=>assert.fail('unexpected failure'),15,null)
        replay.dispose()
        assert.equal(audio.copies.length,2)
        assert.ok(audio.copies.every(track=>track.stopped))
        assert.ok(source.copies.every(track=>track.stopped))
        assert.equal(audio.stopped,false)
        assert.equal(source.stopped,false)
    }finally{restore()}
})
test('remote media prefers separate live audio and ignores ended tracks',()=>{
    const {video,restore}=setup()
    try{
        const embedded=new Track(), separate=new Track(), ended=new Track()
        ended.stop()
        ;(video.srcObject as unknown as Stream).getAudioTracks=()=>[embedded]
        const audioStream=new Stream([])
        audioStream.getAudioTracks=()=>[ended,separate]
        const remote={srcObject:audioStream} as unknown as HTMLAudioElement
        const first=cloneRemoteMedia(video,remote)
        assert.equal(separate.copies.length,1)
        assert.equal(embedded.copies.length,0)
        assert.equal(ended.copies.length,0)
        first.tracks.forEach(track=>track.stop())
        audioStream.getAudioTracks=()=>[ended]
        const fallback=cloneRemoteMedia(video,remote)
        assert.equal(embedded.copies.length,1)
        fallback.tracks.forEach(track=>track.stop())
    }finally{restore()}
})
test('video-only clips and replay skip separate and multiplexed audio tracks',()=>{
    const {source,video,restore}=setup()
    try{
        const embedded=new Track(), separate=new Track()
        ;(video.srcObject as unknown as Stream).getAudioTracks=()=>[embedded]
        const audioStream=new Stream([])
        audioStream.getAudioTracks=()=>[separate]
        const audio={srcObject:audioStream} as unknown as HTMLAudioElement
        const recording=startStreamRecording(video,()=>{},audio,{includeAudio:false})
        recording.stop()
        Recorder.all[0].finish()
        const replay=startInstantReplay(video,()=>{},()=>assert.fail('unexpected failure'),15,audio,false)
        replay.dispose()
        assert.equal(separate.copies.length,0)
        assert.equal(embedded.copies.length,0)
        assert.equal(source.copies.length,2)
        assert.ok(source.copies.every(track=>track.stopped))
    }finally{restore()}
})
test('failed audio cloning releases partially allocated video without stopping source',()=>{
    const {source,video,restore}=setup()
    try{
        const audio=new Track()
        audio.clone=()=>{throw new Error('clone failed')}
        ;(video.srcObject as unknown as Stream).getAudioTracks=()=>[audio]
        assert.throws(()=>startStreamRecording(video,()=>{},null),/clone failed/)
        assert.throws(()=>startInstantReplay(video,()=>{},()=>{},15,null),/clone failed/)
        assert.equal(source.copies.length,2)
        assert.ok(source.copies.every(track=>track.stopped))
        assert.equal(source.stopped,false)
        assert.equal(audio.stopped,false)
        assert.equal(Recorder.all.length,0)
    }finally{restore()}
})
test('replay save joins a segment that is inactive but still finalizing',async()=>{
    const {video,restore}=setup()
    let replay:ReturnType<typeof startInstantReplay>|undefined
    try{
        replay=startInstantReplay(video,()=>{},()=>assert.fail('unexpected failure'))
        const recorder=Recorder.all[0]
        recorder.data(new Blob(['first']))
        recorder.stop()
        const pending=replay.save()
        assert.equal(await replay.save(),null)
        recorder.data(new Blob(['final']))
        recorder.finish()
        assert.equal(await (await pending)?.text(),'firstfinal')
        assert.equal(Recorder.all.length,2)
        assert.equal(recorder.onstop,null)
        assert.equal(recorder.ondataavailable,null)
    }finally{replay?.dispose();restore()}
})
test('replay disposal detaches recorder events and releases pending save',async()=>{
    const {source,video,restore}=setup()
    try{
        const replay=startInstantReplay(video,()=>{},()=>assert.fail('unexpected failure'))
        const recorder=Recorder.all[0]
        const pending=replay.save()
        replay.dispose()
        assert.equal(await pending,null)
        assert.equal(recorder.ondataavailable,null)
        assert.equal(recorder.onerror,null)
        assert.equal(recorder.onstop,null)
        assert.equal(source.copies[0].stopped,true)
    }finally{restore()}
})

test('recording settings accept only supported quality and duration presets',()=>{
    assert.deepEqual(recordingOptions(600,1500000),{seconds:600,videoBitsPerSecond:1500000})
    assert.deepEqual(recordingOptions(60,6000000),{seconds:60,videoBitsPerSecond:6000000})
    assert.deepEqual(recordingOptions(99999,Infinity),{seconds:300,videoBitsPerSecond:3000000})
    assert.deepEqual(recordingOptions('60','6000000'),{seconds:300,videoBitsPerSecond:3000000})
})
test('recording applies selected encoding quality and stops before its hard memory cap',()=>{
    const {video,restore}=setup()
    try{
        const results:any[]=[]
        startStreamRecording(video,(blob,error)=>results.push({blob,error}),null,{seconds:600,videoBitsPerSecond:1500000})
        const recorder=Recorder.all[0]
        assert.equal(recorder.options?.videoBitsPerSecond,1500000)
        recorder.data(new Blob([new Uint8Array(recordingStopThresholdBytes)]))
        assert.equal(recorder.state,'inactive')
        recorder.data(new Blob(['final']))
        recorder.finish()
        assert.equal(results[0].error,false)
        assert.equal(results[0].blob.size,recordingStopThresholdBytes+5)
        assert.ok(results[0].blob.size<=recordingLimitBytes)
    }finally{restore()}
})
test('recording preferences survive portable settings but invalid inputs are ignored',async()=>{
    const {portableSettings}=await import('../../renderer/lib/settingsbackup')
    assert.equal(portableSettings({recording_seconds:600,recording_bitrate:1500000}).recording_seconds,600)
    assert.equal(portableSettings({recording_seconds:600,recording_bitrate:1500000}).recording_bitrate,1500000)
    assert.deepEqual(portableSettings({recording_seconds:-1,recording_bitrate:1}),{})
})
