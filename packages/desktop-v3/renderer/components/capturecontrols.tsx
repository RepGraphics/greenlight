import {useEffect,useRef,useState} from 'react'
import {WebCaptureSession,webCaptureMedia,downloadWebCapture,webRecordingDurations,webRecordingBitrates,webReplayDurations,type WebCaptureState} from '../utils/webcapture'
import {recordingMimeType} from '../../../desktop/renderer/lib/streamrecording'
import {useStreamPreferences} from '../contexts/StreamPreferencesContext'

export default function CaptureControls({surface}:{surface:()=>HTMLElement|null}){
    const {preferences}=useStreamPreferences()
    const [state,setState]=useState<WebCaptureState>({phase:'idle'})
    const [supported,setSupported]=useState(false)
    const [error,setError]=useState(false)
    const [seconds,setSeconds]=useState(preferences.clipSeconds)
    const [bitrate,setBitrate]=useState(preferences.clipBitrate)
    const [replaySeconds,setReplaySeconds]=useState(preferences.replaySeconds)
    const [preview,setPreview]=useState(false)
    const [previewUrl,setPreviewUrl]=useState<string|null>(null)
    const session=useRef<WebCaptureSession|null>(null)
    useEffect(()=>{
        const capture=new WebCaptureSession(setState)
        session.current=capture
        setState({phase:'idle'})
        try{setSupported(Boolean(recordingMimeType()))}catch{setSupported(false)}
        return()=>{session.current=null;capture.reset()}
    },[])
    useEffect(()=>{
        setPreview(false)
    },[state.blob])
    useEffect(()=>{
        if(!preview||!state.blob){setPreviewUrl(null);return}
        const url=URL.createObjectURL(state.blob)
        setPreviewUrl(url)
        return()=>URL.revokeObjectURL(url)
    },[preview,state.blob])
    const replayActive=state.phase==='replay'||state.phase==='savingReplay'
    const busy=['capturing','recording','stopping'].includes(state.phase)||replayActive
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    const screenshot=()=>{
        setError(false)
        const {video}=webCaptureMedia(surface())
        if(!video){setError(true);return}
        void session.current?.takeScreenshot(video)
    }
    const record=()=>{
        setError(false)
        const {video,audio}=webCaptureMedia(surface())
        if(!video){setError(true);return}
        session.current?.startRecording(video,audio,{seconds,videoBitsPerSecond:bitrate,includeAudio:preferences.captureAudio})
    }
    const startReplay=()=>{
        setError(false)
        const {video,audio}=webCaptureMedia(surface())
        if(!video){setError(true);return}
        session.current?.startReplay(video,audio,replaySeconds,preferences.captureAudio)
    }
    return <section aria-label="Local game captures" className="my-3 rounded border border-white/10 p-3">
        <h2 className="font-semibold">Game captures (experimental)</h2>
        <p className="text-sm text-white/60 my-2">{preferences.captureAudio?'Captures include game audio when available.':'Captures use video only.'} Save before leaving or starting another capture. Manual clips stop at the selected duration or the 128 MiB limit.</p>
        {supported&&<div className="flex flex-wrap gap-3 my-3">
            <label>Maximum clip duration <select className="bg-[#202020] rounded p-2" disabled={busy} value={seconds} onChange={event=>setSeconds(Number(event.target.value))}>{webRecordingDurations.map(value=><option key={value} value={value}>{value/60} min</option>)}</select></label>
            <label>Recording video bitrate <select className="bg-[#202020] rounded p-2" disabled={busy} value={bitrate} onChange={event=>setBitrate(Number(event.target.value))}>{webRecordingBitrates.map(value=><option key={value} value={value}>{value/1000000} Mbps</option>)}</select></label>
        </div>}
        {supported&&<div className="my-3 rounded border border-white/10 p-3">
            <h3 className="font-semibold">Instant replay (experimental)</h3>
            <p className="text-sm text-white/60 my-2">Opt in to recording short rolling game-video segments in memory. Replay saves the current or most recent completed segment, not an exact continuous history. Saving stops the buffer. No microphone capture or uploads.</p>
            <div className="flex flex-wrap gap-2 items-center">
                <label>Replay segment <select className="bg-[#202020] rounded p-2" disabled={busy} value={replaySeconds} onChange={event=>setReplaySeconds(Number(event.target.value))}>{webReplayDurations.map(value=><option key={value} value={value}>{value} seconds</option>)}</select></label>
                {!replayActive&&<button type="button" className={button} disabled={busy||state.phase==='ready'} onClick={startReplay}>Enable replay buffer</button>}
                {state.phase==='replay'&&<button type="button" className={button} onClick={()=>void session.current?.saveReplay()}>Save replay and stop</button>}
                {replayActive&&<button type="button" className={button} onClick={()=>session.current?.cancelReplay()}>Disable and discard replay</button>}
            </div>
            {state.phase==='replay'&&<p role="status">{state.replayReady?'Replay buffer ready — recording continues.':'Replay buffer enabled — recording first segment.'}</p>}
            {state.phase==='savingReplay'&&<p role="status">Finishing replay…</p>}
        </div>}
        <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy} onClick={screenshot}>Take screenshot</button>
            {supported&&<button type="button" className={button} disabled={busy} onClick={record}>Record clip</button>}
            {state.phase==='recording'&&<button type="button" className={button} onClick={()=>session.current?.stop()}>Stop recording</button>}
            {state.phase==='ready'&&state.blob&&state.filename&&<button type="button" className={button} onClick={()=>{try{downloadWebCapture(state.blob!,state.filename!)}catch{setError(true)}}}>Save capture</button>}
        </div>
        {busy&&!replayActive&&<p role="status">{state.phase==='recording'?'Recording…':state.phase==='stopping'?'Finishing clip…':'Capturing frame…'}</p>}
        {state.phase==='ready'&&state.blob&&<>
            <p role="status">Capture ready: {state.filename} · {(state.blob.size/1048576).toFixed(2)} MiB</p>
            <div className="flex flex-wrap gap-2 my-2">
                <button type="button" className={button} aria-pressed={preview} onClick={()=>setPreview(value=>!value)}>{preview?'Hide preview':'Preview capture'}</button>
                <button type="button" className={button} onClick={()=>{session.current?.discard();setError(false)}}>Discard capture</button>
            </div>
            {preview&&previewUrl&&(state.blob.type==='image/png'?<img src={previewUrl} alt="Captured game frame" className="max-w-full max-h-80"/>:<video src={previewUrl} controls preload="metadata" playsInline className="max-w-full max-h-80"/>)}
        </>}
        {(state.phase==='failed'||error)&&<p role="alert">Capture unavailable or failed. Check browser support and wait for decoded video.</p>}
    </section>
}
