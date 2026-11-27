import {useState, type ReactNode} from 'react'
import Head from 'next/head'
import {AudioLines, Cloud, Gamepad2, HardDrive, LayoutGrid, Video} from 'lucide-react'
import ControllerBindings from '../components/controllerbindings'
import ControllerCalibration from '../components/controllercalibration'
import DashboardLayout from '../components/dashboardlayout'
import {useStreamPreferences} from '../contexts/StreamPreferencesContext'
import {parseSessionBitrate, sessionBitrates, sessionBitrateLabel} from '../../../desktop/renderer/lib/sessionquality'
import {parseWebDeadzone, parseWebVolume, webControllerPresets, type WebControllerPreset} from '../utils/controlleroptions'
import {
    defaultStreamPreferences, normalizeStreamPreferences, preferredControllerProfile,
    streamLanguages, type StreamPreferences,
} from '../utils/streampreferences'
import {selectWebVideoPreset, updateWebVideoFilter, webVideoPresets, webVideoSliders} from '../utils/videoappearance'
import {webRecordingBitrates, webRecordingDurations, webReplayDurations} from '../utils/webcapture'
import type {WebTouchMode} from '../utils/sessionoptions'

const categories = [
    {id: 'streaming', label: 'Streaming', Icon: Cloud},
    {id: 'playback', label: 'Video & audio', Icon: AudioLines},
    {id: 'controller', label: 'Controller', Icon: Gamepad2},
    {id: 'captures', label: 'Captures', Icon: Video},
    {id: 'library', label: 'Library', Icon: LayoutGrid},
    {id: 'backup', label: 'Backup', Icon: HardDrive},
] as const
const languageNames = new Intl.DisplayNames(['en'], {type: 'language'})
const backupFormat = 'greenlight-v3-preferences'

function Section({title, children}: {title: string; children: ReactNode}) {
    return <section className="v3-preference-section">
        <h2>{title}</h2>
        <div className="v3-preference-rows">{children}</div>
    </section>
}

function Row({id, title, description, children}: {id?: string; title: string; description?: string; children: ReactNode}) {
    return <div className="v3-preference-row">
        <div>{id ? <label htmlFor={id}>{title}</label> : <span>{title}</span>}
            {description && <p>{description}</p>}
        </div>
        <div className="v3-preference-control">{children}</div>
    </div>
}

function Toggle({id, title, description, checked, onChange}: {
    id: string; title: string; description?: string; checked: boolean; onChange: (value: boolean) => void
}) {
    return <Row id={id} title={title} description={description}>
        <input id={id} type="checkbox" className="v3-switch" checked={checked} onChange={event => onChange(event.target.checked)}/>
    </Row>
}

const bitrateChoices = sessionBitrates.map(cap => <option value={cap} key={cap}>{sessionBitrateLabel(cap, 'Automatic')}</option>)

export default function SettingsPage() {
    const {preferences, savePreferences, storageAvailable} = useStreamPreferences()
    const [category, setCategory] = useState<(typeof categories)[number]['id']>('streaming')
    const [backupStatus, setBackupStatus] = useState('')
    const [backupError, setBackupError] = useState(false)
    const profile = preferredControllerProfile(preferences)
    const update = (changes: Partial<StreamPreferences>) => savePreferences({...preferences, ...changes})

    const exportBackup = () => {
        const blob = new Blob([JSON.stringify({format: backupFormat, version: 1, preferences}, null, 2)], {type: 'application/json'})
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'greenlight-v3-settings.json'
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    async function importBackup(file: File) {
        try {
            if (file.size > 65536) throw Error('Backup is too large')
            const data = JSON.parse(await file.text())
            if (data?.format !== backupFormat || data.version !== 1 || !data.preferences
                || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) throw Error('Invalid backup')
            if (!window.confirm('Replace your current Greenlight preferences with this backup?')) return
            savePreferences(normalizeStreamPreferences(data.preferences))
            setBackupError(false)
            setBackupStatus('Settings imported.')
        } catch {
            setBackupError(true)
            setBackupStatus('Couldn’t read this file as a Greenlight V3 settings backup.')
        }
    }

    return <DashboardLayout>
        <Head><title>Settings · Greenlight V3</title></Head>
        <header className="v3-page-header">
            <div><h1>Settings</h1><p>Preferences are saved on this device.</p></div>
        </header>
        {!storageAvailable && <p className="v3-notice" role="status">Changes apply until this window closes. Local storage is unavailable.</p>}
        <nav className="v3-settings-nav" aria-label="Settings categories">
            {categories.map(({id, label, Icon}) => <button key={id} type="button" aria-pressed={category === id} onClick={event => {
                setCategory(id)
                event.currentTarget.closest('main')?.scrollTo({top: 0})
            }}>
                <Icon size={17} aria-hidden="true"/>{label}
            </button>)}
        </nav>
        {category === 'streaming' && <>
            <Section title="Cloud Gaming">
                <Row id="cloud-resolution" title="Resolution" description="Requested video resolution for new cloud sessions.">
                    <select id="cloud-resolution" className="v3-field" value={preferences.resolution} onChange={event => update({resolution: event.target.value === '720' ? 720 : 1080})}>
                        <option value="1080">1080p</option><option value="720">720p</option>
                    </select>
                </Row>
                <Row id="cloud-bitrate" title="Requested bitrate" description="Set a video bandwidth limit, or let Xbox choose.">
                    <select id="cloud-bitrate" className="v3-field" value={preferences.bitrate} onChange={event => {
                        const bitrate = parseSessionBitrate(event.target.value)
                        if (bitrate !== null) update({bitrate})
                    }}>{bitrateChoices}</select>
                </Row>
            </Section>
            <Section title="Remote Play">
                <Row id="remote-resolution" title="Remote Play resolution">
                    <select id="remote-resolution" className="v3-field" value={preferences.remoteResolution ?? ''} onChange={event => {
                        const value = event.target.value
                        update({remoteResolution: value === '720' ? 720 : value === '1080' ? 1080 : null})
                    }}><option value="">Same as Cloud Gaming</option><option value="1080">1080p</option><option value="720">720p</option></select>
                </Row>
                <Row id="remote-bitrate" title="Remote Play bitrate">
                    <select id="remote-bitrate" className="v3-field" value={preferences.remoteBitrate ?? ''} onChange={event => update({remoteBitrate: parseSessionBitrate(event.target.value)})}>
                        <option value="">Same as Cloud Gaming</option>{bitrateChoices}
                    </select>
                </Row>
            </Section>
            <Section title="Session">
                <Row id="stream-language" title="Preferred game language" description="Requested for new sessions where Xbox and the game support it.">
                    <select id="stream-language" className="v3-field" value={preferences.gameLanguage} onChange={event => update({gameLanguage: event.target.value})}>
                        <option value="">Device language</option>
                        {streamLanguages.map(language => <option key={language} value={language}>{languageNames.of(language)}</option>)}
                    </select>
                </Row>
                <Toggle id="stream-stats" title="Show performance statistics" description="Show the connection overlay when playback starts." checked={preferences.showStats} onChange={showStats => update({showStats})}/>
            </Section>
        </>}
        {category === 'playback' && <>
            <Section title="Audio">
                <Row id="playback-volume" title="Default volume">
                    <input id="playback-volume" type="range" min="0" max="100" value={Math.round(preferences.volume * 100)}
                        onChange={event => {const volume = parseWebVolume(event.target.value); if (volume !== null) update({volume})}}/>
                    <output htmlFor="playback-volume">{Math.round(preferences.volume * 100)}%</output>
                </Row>
                <Toggle id="playback-mute" title="Start muted" checked={preferences.muted} onChange={muted => update({muted})}/>
            </Section>
            <Section title="Video appearance">
                <Row id="video-preset" title="Video preset" description="Applies to the picture on screen. Saved captures use the original video.">
                    <select id="video-preset" className="v3-field" value={webVideoPresets.find(({id}) => {
                        const preset = selectWebVideoPreset(id)
                        return webVideoSliders.every(({key}) => preset[key] === preferences.videoFilters[key])
                    })?.id ?? 'custom'} onChange={event => update({videoFilters: selectWebVideoPreset(event.target.value)})}>
                        <option value="custom" disabled>Custom</option>
                        {webVideoPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                    </select>
                </Row>
                {webVideoSliders.map(({key, label, min, max}) => <Row key={key} id={'picture-'+key} title={label}>
                    <input id={'picture-'+key} type="range" min={min} max={max} value={preferences.videoFilters[key]} onChange={event =>
                        update({videoFilters: updateWebVideoFilter(preferences.videoFilters, key, event.target.value)})}/>
                    <output htmlFor={'picture-'+key}>{preferences.videoFilters[key]}%</output>
                </Row>)}
            </Section>
        </>}
        {category === 'controller' && <>
            <Section title="Physical controller">
                <Row id="controller-preset" title="Controller preset" description="Changing the preset resets stick and button overrides.">
                    <select id="controller-preset" className="v3-field" value={preferences.preset} onChange={event => update({
                        preset: event.target.value as WebControllerPreset, deadzone: null, invertY: null, swapSticks: null, buttonMapping: null,
                    })}>{Object.entries(webControllerPresets).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}</select>
                </Row>
                <Row id="controller-deadzone" title="Stick deadzone">
                    <input id="controller-deadzone" type="range" min="0" max="50" value={Math.round(profile.v3_deadzone * 100)}
                        onChange={event => {const deadzone = parseWebDeadzone(event.target.value); if (deadzone !== null) update({deadzone})}}/>
                    <output htmlFor="controller-deadzone">{Math.round(profile.v3_deadzone * 100)}%</output>
                </Row>
                <Toggle id="controller-invert" title="Invert vertical stick axes" checked={profile.v3_invert_y} onChange={invertY => update({invertY})}/>
                <Toggle id="controller-swap" title="Swap left and right sticks" checked={profile.v3_swap_sticks} onChange={swapSticks => update({swapSticks})}/>
                <Toggle id="controller-vibration" title="Controller vibration" checked={preferences.vibration} onChange={vibration => update({vibration})}/>
                <Toggle id="controller-multi" title="Multiple local controllers" checked={preferences.multipleControllers} onChange={multipleControllers => update({multipleControllers})}/>
            </Section>
            <Section title="Input modes">
                <Toggle id="controller-paired" title="Controller connected directly to Xbox" description="Use only the controller paired with your Xbox during Remote Play." checked={preferences.consolePaired} onChange={consolePaired => update({consolePaired})}/>
                <Toggle id="controller-keyboard" title="Keyboard controller emulation" checked={preferences.keyboard} onChange={keyboard => update({keyboard})}/>
                <Row id="controller-touch" title="Touch input">
                    <select id="controller-touch" className="v3-field" value={preferences.touch} onChange={event => update({touch: event.target.value as WebTouchMode})}>
                        <option value="off">Off</option><option value="controller">On-screen controller</option><option value="direct">Direct touch</option>
                    </select>
                </Row>
            </Section>
            <Section title="Controller tools">
                <ControllerCalibration deadzone={profile.v3_deadzone} onApply={deadzone => update({deadzone})}/>
                <ControllerBindings mapping={profile.v3_button_mapping} persistent onChange={buttonMapping => update({buttonMapping})}/>
            </Section>
        </>}
        {category === 'captures' && <>
            <Section title="Manual clips">
                <Row id="record-duration" title="Maximum clip duration" description="Large clips may stop earlier at the recorder size limit.">
                    <select id="record-duration" className="v3-field" value={preferences.clipSeconds} onChange={event => update({clipSeconds: Number(event.target.value)})}>
                        {webRecordingDurations.map(seconds => <option key={seconds} value={seconds}>{seconds / 60} min</option>)}
                    </select>
                </Row>
                <Row id="record-bitrate" title="Recording video bitrate">
                    <select id="record-bitrate" className="v3-field" value={preferences.clipBitrate} onChange={event => update({clipBitrate: Number(event.target.value)})}>
                        {webRecordingBitrates.map(bitrate => <option key={bitrate} value={bitrate}>{bitrate / 1000000} Mbps</option>)}
                    </select>
                </Row>
            </Section>
            <Section title="Instant replay">
                <Row id="replay-duration" title="Replay segment duration" description="Used when you turn on the replay buffer during a stream.">
                    <select id="replay-duration" className="v3-field" value={preferences.replaySeconds} onChange={event => update({replaySeconds: Number(event.target.value)})}>
                        {webReplayDurations.map(seconds => <option key={seconds} value={seconds}>{seconds} sec</option>)}
                    </select>
                </Row>
                <Toggle id="record-audio" title="Include game audio in captures" description="Applies to manual clips and instant replays." checked={preferences.captureAudio} onChange={captureAudio => update({captureAudio})}/>
            </Section>
        </>}
        {category === 'library' && <Section title="Cloud Gaming library">
            <Row id="library-layout" title="Game layout">
                <select id="library-layout" className="v3-field" value={preferences.libraryLayout} onChange={event => update({libraryLayout: event.target.value === 'list' ? 'list' : 'grid'})}>
                    <option value="grid">Cover grid</option><option value="list">Compact list</option>
                </select>
            </Row>
            <Toggle id="library-unavailable" title="Show games without cloud access" description="Include games your current Xbox account can’t play." checked={preferences.showUnavailable} onChange={showUnavailable => update({showUnavailable})}/>
        </Section>}
        {category === 'backup' && <Section title="Local preferences">
            <Row title="Export settings" description="Download a JSON file containing your preferences.">
                <button type="button" className="v3-button v3-button-secondary" onClick={exportBackup}>Export settings</button>
            </Row>
            <Row id="preferences-import" title="Import settings" description="Load a Greenlight V3 preferences backup from this device.">
                <input id="preferences-import" className="v3-input-file" type="file" accept=".json,application/json" onChange={event => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void importBackup(file)
                }}/>
            </Row>
            <Row title="Restore defaults" description="Reset all V3 preferences on this device.">
                <button type="button" className="v3-button v3-button-secondary" onClick={() => {
                    if (window.confirm('Restore all Greenlight V3 settings to their defaults?')) {
                        savePreferences(defaultStreamPreferences)
                        setBackupError(false)
                        setBackupStatus('Defaults restored.')
                    }
                }}>Restore defaults</button>
            </Row>
            {backupStatus && <p className="v3-preference-message" role={backupError ? 'alert' : 'status'}>{backupStatus}</p>}
        </Section>}
    </DashboardLayout>
}
