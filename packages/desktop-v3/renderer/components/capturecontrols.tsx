import {useEffect,useRef,useState,type MutableRefObject} from 'react'
import ClipPreview from './clippreview'
import {canShareCapture,shareCapture,type ShareResult} from '../utils/webcaptureshare'
import {WebCaptureSession,webCaptureMedia,downloadWebCapture,isWebCaptureClip,webRecordingDurations,webRecordingBitrates,webReplayDurations,type WebCaptureState} from '../utils/webcapture'
import {recordingMimeType} from '../../../desktop/renderer/lib/streamrecording'
import {useStreamPreferences} from '../contexts/StreamPreferencesContext'

export default function CaptureControls({surface,connected,onRetainedChange,sessionRef}:{surface:()=>HTMLElement|null;connected:boolean;onRetainedChange:(retained:boolean)=>void;sessionRef:MutableRefObject<WebCaptureSession|null>}){
    const {preferences}=useStreamPreferences()
    const [state,setState]=useState<WebCaptureState>({phase:'idle'})
    const [supported,setSupported]=useState(false)
    const [error,setError]=useState(false)
    const [seconds,setSeconds]=useState<number>(preferences.clipSeconds)
    const [bitrate,setBitrate]=useState<number>(preferences.clipBitrate)
    const [replaySeconds,setReplaySeconds]=useState<number>(preferences.replaySeconds)
    const [sharing,setSharing]=useState(false)
    const [shareResult,setShareResult]=useState<ShareResult|null>(null)
    const [shareOptions,setShareOptions]=useState({original:false,trimmed:false})
    const shareLock=useRef(false)
    const mounted=useRef(false)
    const [preview,setPreview]=useState(false)
    const [previewMedia,setPreviewMedia]=useState<{blob:Blob;url:string}|null>(null)
    const session=useRef<WebCaptureSession|null>(null)
    const {blob,filename,trim}=state
    const trimmedCopy=trim?.phase==='ready'?trim:null
    useEffect(()=>{
        mounted.current=true
        const capture=new WebCaptureSession(next=>{
            onRetainedChange(next.phase!=='idle'&&next.phase!=='failed')
            setState(next)
        })
        session.current=capture;sessionRef.current=capture
        setState({phase:'idle'})
        try{setSupported(Boolean(recordingMimeType()))}catch{setSupported(false)}
        return()=>{mounted.current=false;session.current=null;if(sessionRef.current===capture)sessionRef.current=null;capture.reset()}
    },[])
    useEffect(()=>{if(!connected)session.current?.suspendLiveCapture()},[connected])
    useEffect(()=>{
        setPreview(false)
    },[blob])
    useEffect(()=>{
        setShareResult(null)
        setShareOptions({original:Boolean(blob&&filename&&canShareCapture(navigator,blob,filename)),trimmed:Boolean(trimmedCopy&&canShareCapture(navigator,trimmedCopy.blob,trimmedCopy.filename))})
    },[blob,filename,trimmedCopy])
    useEffect(()=>{
        if(!preview||!blob){setPreviewMedia(null);return}
        const url=URL.createObjectURL(blob)
        setPreviewMedia({blob,url})
        return()=>URL.revokeObjectURL(url)
    },[preview,blob])
    const previewUrl=previewMedia?.blob===blob?previewMedia?.url:undefined
    const replayActive=state.phase==='replay'||state.phase==='savingReplay'
    const captureActive=['capturing','recording','stopping'].includes(state.phase)
    const busy=captureActive||replayActive||trim?.phase==='running'||sharing
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    const screenshot=()=>{
        if(!connected||busy||state.phase==='ready')return
        setError(false)
        const {video}=webCaptureMedia(surface())
        if(!video){setError(true);return}
        void session.current?.takeScreenshot(video)
    }
    const record=()=>{
        if(!connected||busy||state.phase==='ready')return
        setError(false)
        const {video,audio}=webCaptureMedia(surface())
        if(!video){setError(true);return}
        session.current?.startRecording(video,audio,{seconds,videoBitsPerSecond:bitrate,includeAudio:preferences.captureAudio})
    }
    const startReplay=()=>{
        if(!connected||busy||state.phase==='ready')return
        setError(false)
        const {video,audio}=webCaptureMedia(surface())
        if(!video){setError(true);return}
        session.current?.startReplay(video,audio,replaySeconds,preferences.captureAudio)
    }
    const download=(blob:Blob,filename:string)=>{
        setError(false)
        try{downloadWebCapture(blob,filename)}catch{setError(true)}
    }
    const share=async(media:Blob,name:string)=>{
        if(shareLock.current)return
        shareLock.current=true;setSharing(true);setShareResult(null)
        try{const result=await shareCapture(navigator,media,name);if(mounted.current)setShareResult(result)}
        finally{shareLock.current=false;if(mounted.current)setSharing(false)}
    }
    const togglePreview=()=>{
        if(preview)session.current?.cancelTrim()
        setPreview(value=>!value)
    }
    if(!connected&&state.phase==='idle'&&!error)return null
    return <section aria-label="Local game captures" className="my-3 rounded border border-white/10 p-3">
        <h2 className="font-semibold">Game captures (experimental)</h2>
        <p className="text-sm text-white/60 my-2">{preferences.captureAudio?'Captures include game audio when available.':'Captures use video only.'} Completed captures remain available when playback stops or returns to setup. Save or discard them before capturing again. Leaving the game page discards local captures. Manual clips stop at the selected duration or the 128 MiB limit. Browser downloads may not be supported in Android WebView.</p>
        {!connected&&<p role="status" className="text-sm text-white/60">Stream inactive. You can still preview, trim, save or share a completed capture.</p>}
        {connected&&supported&&<div className="flex flex-wrap gap-3 my-3">
            <label>Maximum clip duration <select className="bg-[#202020] rounded p-2" disabled={busy} value={seconds} onChange={event=>setSeconds(Number(event.target.value))}>{webRecordingDurations.map(value=><option key={value} value={value}>{value/60} min</option>)}</select></label>
            <label>Recording video bitrate <select className="bg-[#202020] rounded p-2" disabled={busy} value={bitrate} onChange={event=>setBitrate(Number(event.target.value))}>{webRecordingBitrates.map(value=><option key={value} value={value}>{value/1000000} Mbps</option>)}</select></label>
        </div>}
        {(connected||replayActive)&&supported&&<div className="my-3 rounded border border-white/10 p-3">
            <h3 className="font-semibold">Instant replay (experimental)</h3>
            <p className="text-sm text-white/60 my-2">Opt in to recording short rolling game-video segments in memory. Replay saves the current or most recent completed segment, not an exact continuous history. Saving stops the buffer. No microphone capture or uploads.</p>
            <div className="flex flex-wrap gap-2 items-center">
                <label>Replay segment <select className="bg-[#202020] rounded p-2" disabled={busy} value={replaySeconds} onChange={event=>setReplaySeconds(Number(event.target.value))}>{webReplayDurations.map(value=><option key={value} value={value}>{value} seconds</option>)}</select></label>
                {!replayActive&&<button type="button" className={button} disabled={!connected||busy||state.phase==='ready'} onClick={startReplay}>Enable replay buffer</button>}
                {state.phase==='replay'&&<button type="button" className={button} onClick={()=>void session.current?.saveReplay()}>Save replay and stop</button>}
                {replayActive&&<button type="button" className={button} onClick={()=>session.current?.cancelReplay()}>Disable and discard replay</button>}
            </div>
            {state.phase==='replay'&&<p role="status">{state.replayReady?'Replay buffer ready — recording continues.':'Replay buffer enabled — recording first segment.'}</p>}
            {state.phase==='savingReplay'&&<p role="status">Finishing replay…</p>}
        </div>}
        <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={!connected||busy||state.phase==='ready'} onClick={screenshot}>Take screenshot</button>
            {supported&&<button type="button" className={button} disabled={!connected||busy||state.phase==='ready'} onClick={record}>Record clip</button>}
            {state.phase==='recording'&&<button type="button" className={button} onClick={()=>session.current?.stop()}>Stop recording</button>}
            {state.phase==='ready'&&blob&&filename&&<button type="button" className={button} onClick={()=>download(blob,filename)}>Save capture</button>}
            {trimmedCopy&&<button type="button" className={button} onClick={()=>download(trimmedCopy.blob,trimmedCopy.filename)}>Save trimmed copy</button>}
            {blob&&filename&&shareOptions.original&&<button type="button" className={button} disabled={busy} onClick={()=>void share(blob,filename)}>Share capture</button>}
            {trimmedCopy&&shareOptions.trimmed&&<button type="button" className={button} disabled={busy} onClick={()=>void share(trimmedCopy.blob,trimmedCopy.filename)}>Share trimmed copy</button>}
        </div>
        {shareResult&&<p role="status">{shareResult==='shared'?'Capture handed to the system share chooser.':shareResult==='cancelled'?'Sharing cancelled.':shareResult==='unavailable'?'File sharing unavailable in this browser.':'Unable to share capture.'}</p>}
        {captureActive&&<p role="status">{state.phase==='recording'?'Recording…':state.phase==='stopping'?'Finishing clip…':'Capturing frame…'}</p>}
        {state.phase==='ready'&&blob&&<>
            <p role="status">Capture ready: {filename} · {(blob.size/1048576).toFixed(2)} MiB</p>
            {trimmedCopy&&<p role="status">Trimmed copy ready to save.</p>}
            <div className="flex flex-wrap gap-2 my-2">
                <button type="button" className={button} aria-pressed={preview} onClick={togglePreview}>{preview?'Hide preview':'Preview capture'}</button>
                <button type="button" className={button} disabled={sharing} onClick={()=>{session.current?.discard();setError(false)}}>Discard capture</button>
            </div>
            {preview&&previewUrl&&(blob.type==='image/png'
                ?<img src={previewUrl} alt="Captured game frame" className="max-w-full max-h-80"/>
                :isWebCaptureClip(blob)
                    ?<ClipPreview key={previewUrl} url={previewUrl} trim={trim} onTrim={(video,range)=>{if(!shareLock.current)void session.current?.trim(blob,video,range)}} onCancel={()=>session.current?.cancelTrim()}/>
                    :<video src={previewUrl} controls preload="metadata" playsInline className="max-w-full max-h-80"/>)}
        </>}
        {(state.phase==='failed'||error)&&<><p role="alert">Capture unavailable or failed. Check browser support and wait for decoded video.</p>{!connected&&<button type="button" className={button} onClick={()=>{session.current?.discard();setError(false)}}>Dismiss capture error</button>}</>}
    </section>
}
