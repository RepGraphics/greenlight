import {useEffect,useState} from 'react'
import Head from 'next/head'
import Sidebar from '../components/sidebar'
import {detectDeviceCapabilities,capabilityRows,capabilityReport,type DeviceCapabilities} from '../utils/devicecapabilities'

export default function SettingsPage(){
    const [capabilities,setCapabilities]=useState<DeviceCapabilities|null>(null)
    const [copy,setCopy]=useState<'idle'|'success'|'failed'>('idle')
    const refresh=()=>{setCapabilities(detectDeviceCapabilities());setCopy('idle')}
    useEffect(()=>{refresh()},[])
    const report=capabilities?capabilityReport(capabilities):''
    const copyReport=async()=>{
        try{await navigator.clipboard.writeText(report);setCopy('success')}
        catch{setCopy('failed')}
    }
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    return <>
        <Head><title>Greenlight — Device settings</title></Head>
        <div className="flex h-[100dvh] flex-col md:flex-row bg-[#0d0d0d] text-white overflow-hidden">
            <Sidebar/>
            <main className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 md:p-8">
                <h1 className="text-2xl font-bold">Device settings and compatibility</h1>
                <p className="text-white/60 my-3">Check local browser features before starting Remote Play or Cloud Gaming. This does not contact Xbox, request permissions or collect hardware identifiers.</p>
                <button type="button" className={button} onClick={refresh}>Refresh capability checks</button>
                {!capabilities?<p role="status">Checking browser features…</p>:<>
                    {(!capabilities.webrtc||capabilities.h264==='unavailable')&&<p role="alert" className="my-4 rounded border border-white/20 p-3">Required streaming APIs or advertised H.264 support may be missing. Try an updated browser or Android System WebView.</p>}
                    {!capabilities.secure&&<p role="status" className="my-4">This context is not secure. Microphone, clipboard and wake lock features may be unavailable. Use a trusted private HTTPS endpoint.</p>}
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-4">
                        {capabilityRows(capabilities).map(row=><div key={row.label} className="rounded border border-white/10 p-3">
                            <dt>{row.label}</dt><dd className="text-sm text-white/70 capitalize">{row.state}</dd>
                        </div>)}
                    </dl>
                    <p className="text-white/60 text-sm">API presence is not a guarantee of controller connection, actual H.264 decoding, recording, permissions or Xbox interoperability. Android companion still blocks microphone permissions and file downloads.</p>
                    <h2 className="font-semibold mt-6 mb-2">Shareable capability report</h2>
                    <textarea readOnly aria-label="Browser capability report" rows={12} value={report} className="w-full bg-[#202020] rounded p-3 text-sm"/>
                    <button type="button" className={button+' mt-2'} disabled={!capabilities.clipboard} onClick={()=>void copyReport()}>Copy report</button>
                    {copy!=='idle'&&<p role="status">{copy==='success'?'Report copied.':'Clipboard unavailable. Select and copy the report manually.'}</p>}
                </>}
            </main>
        </div>
    </>
}
