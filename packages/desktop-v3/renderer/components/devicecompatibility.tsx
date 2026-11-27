import {useEffect,useState} from 'react'
import {detectDeviceCapabilities,capabilityRows,capabilityReport,type DeviceCapabilities} from '../utils/devicecapabilities'

export default function DeviceCompatibility(){
    const [capabilities,setCapabilities]=useState<DeviceCapabilities|null>(null)
    const [copy,setCopy]=useState('')
    const refresh=()=>{setCapabilities(detectDeviceCapabilities());setCopy('')}
    useEffect(()=>{refresh()},[])
    const report=capabilities?capabilityReport(capabilities):''
    return <section className="v3-preference-section">
        <h2>Device compatibility</h2>
        <p className="v3-muted">Local browser API checks only. No permission requests, account details or Xbox network probes.</p>
        <button type="button" className="v3-button v3-button-secondary my-3" onClick={refresh}>Refresh checks</button>
        {!capabilities?<p role="status">Checking browser features…</p>:<>
            {(!capabilities.webrtc||capabilities.h264==='unavailable')&&<p className="v3-notice" role="alert">Streaming APIs or advertised H.264 receive support may be missing. Try an updated browser or Android System WebView.</p>}
            {!capabilities.secure&&<p className="v3-notice">Use a trusted private HTTPS endpoint for secure-context features.</p>}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-4">
                {capabilityRows(capabilities).map(row=><div className="rounded border border-white/10 p-3" key={row.label}><dt>{row.label}</dt><dd className="v3-muted capitalize">{row.state}</dd></div>)}
            </dl>
            <p className="v3-muted">API presence does not prove hardware decoding, microphone permission, connected controllers or actual gameplay. The companion app has additional permission and download restrictions.</p>
            <label className="block mt-4" htmlFor="device-report">Shareable capability report</label>
            <textarea id="device-report" readOnly rows={12} value={report} className="v3-field w-full my-2"/>
            <button type="button" className="v3-button v3-button-secondary" disabled={!capabilities.clipboard} onClick={async()=>{
                try{await navigator.clipboard.writeText(report);setCopy('Report copied.')}
                catch{setCopy('Clipboard unavailable. Select and copy the report manually.')}
            }}>Copy report</button>
            {copy&&<p role="status">{copy}</p>}
        </>}
    </section>
}
