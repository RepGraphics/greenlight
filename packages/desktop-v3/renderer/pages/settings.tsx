import Head from 'next/head'
import {Monitor, Gamepad2} from 'lucide-react'
import ControllerCalibration from '../components/controllercalibration'
import DashboardLayout from '../components/dashboardlayout'
import {useStreamPreferences} from '../contexts/StreamPreferencesContext'
import {parseSessionBitrate, sessionBitrates, sessionBitrateLabel} from '../../../desktop/renderer/lib/sessionquality'
import {parseWebDeadzone, selectWebControllerPreset, webControllerPresets, type WebControllerPreset} from '../utils/controlleroptions'
import {defaultStreamPreferences, type StreamPreferences} from '../utils/streampreferences'

export default function SettingsPage() {
    const {preferences, savePreferences, storageAvailable} = useStreamPreferences()
    const update = (changes: Partial<StreamPreferences>) => savePreferences({...preferences, ...changes})
    const deadzone = preferences.deadzone ?? selectWebControllerPreset(preferences.preset).v3_deadzone

    return <DashboardLayout>
        <Head><title>Greenlight V3 — Settings</title></Head>
        <header className="v3-page-header">
            <div><h1>Settings</h1><p>Defaults for new streams on this device.</p></div>
            <button type="button" className="v3-button v3-button-secondary" onClick={() => savePreferences(defaultStreamPreferences)}>Restore defaults</button>
        </header>
        {!storageAvailable && <p className="v3-notice" role="status">Changes apply until this window closes. Local storage is unavailable.</p>}
        <div className="v3-settings-grid">
            <section className="v3-panel v3-settings-panel">
                <h2><Monitor size={20} aria-hidden="true"/> Streaming</h2>
                <label className="v3-setting">Resolution
                    <select className="v3-field" value={preferences.resolution} onChange={event => update({resolution: event.target.value === '720' ? 720 : 1080})}>
                        <option value="1080">1080p</option><option value="720">720p</option>
                    </select>
                </label>
                <label className="v3-setting">Requested bitrate
                    <select className="v3-field" value={preferences.bitrate} onChange={event => {
                        const bitrate = parseSessionBitrate(event.target.value)
                        if (bitrate !== null) update({bitrate})
                    }}>{sessionBitrates.map(cap => <option value={cap} key={cap}>{sessionBitrateLabel(cap, 'Automatic')}</option>)}</select>
                </label>
                <label className="v3-check"><input type="checkbox" checked={preferences.showStats} onChange={event => update({showStats: event.target.checked})}/> Show performance statistics</label>
            </section>
            <section className="v3-panel v3-settings-panel">
                <h2><Gamepad2 size={20} aria-hidden="true"/> Controller</h2>
                <label className="v3-setting">Controller preset
                    <select className="v3-field" value={preferences.preset} onChange={event => update({preset: event.target.value as WebControllerPreset, deadzone: null})}>
                        {Object.entries(webControllerPresets).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}
                    </select>
                </label>
                <label className="v3-setting">Stick deadzone · {Math.round(deadzone * 100)}%
                    <input type="range" value={Math.round(deadzone * 100)} min="0" max="50" onChange={event => {
                        const value = parseWebDeadzone(event.target.value)
                        if (value !== null) update({deadzone: value})
                    }}/>
                </label>
                <label className="v3-check"><input type="checkbox" checked={preferences.vibration} onChange={event => update({vibration: event.target.checked})}/> Controller vibration</label>
                <label className="v3-check"><input type="checkbox" checked={preferences.multipleControllers} onChange={event => update({multipleControllers: event.target.checked})}/> Multiple local controllers</label>
                <label className="v3-check"><input type="checkbox" checked={preferences.keyboard} onChange={event => update({keyboard: event.target.checked})}/> Keyboard controller emulation</label>
            </section>
        </div>
        <section className="v3-panel v3-settings-panel v3-calibration">
            <h2>Controller tools</h2>
            <ControllerCalibration deadzone={deadzone} onApply={value => update({deadzone: value})}/>
        </section>
    </DashboardLayout>
}
