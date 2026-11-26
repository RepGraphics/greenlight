import {useEffect,useRef,useState} from 'react'
import {WebCaptureSession,webCaptureMedia,downloadWebCapture,type WebCaptureState} from '../utils/webcapture'
import {recordingMimeType} from '../../../desktop/renderer/lib/streamrecording'

export default function CaptureControls({surface}:{surface:()=>HTMLElement|null}){
    const [state,setState]=useState<WebCaptureState>({phase:'idle'})
    const [supported,setSupported]=useState(false)
    const [error,setError]=useState(false)
    const session=useRef<WebCaptureSession|null>(null)
    useEffect(()=>{
        const capture=new WebCaptureSession(setState)
        session.current=capture
        setState({phase:'idle'})
        setSupported(Boolean(recordingMimeType()))
        return()=>{session.current=null;capture.reset()}
    },[])
    const busy=['capturing','recording','stopping'].includes(state.phase)
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
        session.current?.startRecording(video,audio)
    }
    return <section aria-label="Local game captures" className="my-3 rounded border border-white/10 p-3">
        <h2 className="font-semibold">Game captures (experimental)</h2>
        <p className="text-sm text-white/60 my-2">Capture decoded game video only. Clips include available remote audio, up to 60 seconds or the recorder size limit. Save before leaving or starting another capture. Browser downloads may not be supported in Android WebView.</p>
        <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy} onClick={screenshot}>Take screenshot</button>
            {supported&&<button type="button" className={button} disabled={busy} onClick={record}>Record clip</button>}
            {state.phase==='recording'&&<button type="button" className={button} onClick={()=>session.current?.stop()}>Stop recording</button>}
            {state.phase==='ready'&&state.blob&&state.filename&&<button type="button" className={button} onClick={()=>{try{downloadWebCapture(state.blob!,state.filename!)}catch{setError(true)}}}>Save capture</button>}
        </div>
        {busy&&<p role="status">{state.phase==='recording'?'Recording…':state.phase==='stopping'?'Finishing clip…':'Capturing frame…'}</p>}
        {state.phase==='ready'&&<p role="status">Capture ready to save: {state.filename}</p>}
        {(state.phase==='failed'||error)&&<p role="alert">Capture unavailable or failed. Check browser support and wait for decoded video.</p>}
    </section>
}
