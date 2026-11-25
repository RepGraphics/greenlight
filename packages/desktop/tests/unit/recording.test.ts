import {test} from 'node:test'
import assert from 'node:assert/strict'
import {startStreamRecording,recordingLimitBytes} from '../../renderer/lib/streamrecording'
import {startInstantReplay} from '../../renderer/lib/instantreplay'
class Track {readyState='live';stopped=false;copies:Track[]=[];clone(){const track=new Track();this.copies.push(track);return track}stop(){this.stopped=true;this.readyState='ended'}}
class Stream {constructor(private tracks:Track[]){}getVideoTracks(){return this.tracks}getAudioTracks(){return []}}
class Recorder {
    static all:Recorder[]=[]
    static isTypeSupported(){return true}
    state='inactive'
    ondataavailable:((event:{data:Blob})=>void)|null=null
    onstop:(()=>void)|null=null
    onerror:(()=>void)|null=null
    constructor(){Recorder.all.push(this)}
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
