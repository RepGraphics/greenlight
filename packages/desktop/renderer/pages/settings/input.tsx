import { validateShortcuts, assignShortcut, shortcutDefaults, shortcutKeys } from '../../lib/streamshortcuts'
import type { StreamAction } from '../../lib/streamshortcuts'
import React from 'react'
import ControllerTest from '../../components/settings/controllertest'
import { controllerPresets, readProfiles, snapshotProfile } from '../../lib/controllerprofiles'
import type { ControllerProfile } from '../../lib/controllerprofiles'
import { defaultButtonMapping, validateButtonMapping } from '../../../../player/src/client/lib/input/mapping'
import Head from 'next/head'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'

import { useSettings } from '../../context/userContext'

import { useTranslation } from 'react-i18next'

function invert(obj) {
    const new_obj = {}
    for (const prop in obj) {
        new_obj[obj[prop]] = prop
    }
    return new_obj
}

function KeySettings({keyConfigs, setKeyConfig}) {
    const { t } = useTranslation()
    const mappableButtons = ['DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight', 'A', 'B', 'X', 'Y', 'View', 'Menu', 'Nexus', 'LeftShoulder', 'RightShoulder', 'LeftTrigger', 'RightTrigger', 'LeftThumb', 'RightThumb']
    // console.log('KEYS:', keyConfigs, mappableButtons)
    keyConfigs = invert(keyConfigs)
    return <p>
        {
            mappableButtons.map(
                (btn:string) => {
                    let fullBtnText = ''

                    switch(btn){
                        case 'DPadUp':
                            fullBtnText = t('settings.input.dPadUp')
                            break
                        case 'DPadDown':
                            fullBtnText = t('settings.input.dPadDown')
                            break
                        case 'DPadLeft':
                            fullBtnText = t('settings.input.dPadLeft')
                            break
                        case 'DPadRight':
                            fullBtnText = t('settings.input.dPadRight')
                            break
                        case 'LeftShoulder':
                            fullBtnText = t('settings.input.leftShoulder')
                            break
                        case 'RightShoulder':
                            fullBtnText = t('settings.input.rightShoulder')
                            break
                        case 'LeftTrigger':
                            fullBtnText = t('settings.input.leftTrigger')
                            break
                        case 'RightTrigger':
                            fullBtnText = t('settings.input.rightTrigger')
                            break
                        case 'LeftThumb':
                            fullBtnText = t('settings.input.leftThumb')
                            break
                        case 'RightThumb':
                            fullBtnText = t('settings.input.rightThumb')
                            break
                        case 'View':
                            fullBtnText = t('settings.input.view')
                            break
                        case 'Menu':
                            fullBtnText = t('settings.input.menu')
                            break
                        case 'Nexus':
                            fullBtnText = t('settings.input.nexus')
                        default:
                            fullBtnText = btn
                            break
                    }

                    return <p key={btn}>
                        <label>{fullBtnText}</label>
                        <label style={{minWidth: 0}}>
                            <input type='text' className='text' onKeyUp={(e) => setKeyConfig(btn, e)} value={keyConfigs[btn] ?? t('settings.input.none')}/>
                        </label>
                    </p>
                }
            )
        }
    </p>
}

function SettingsInput() {
    const { settings, setSettings} = useSettings()
    const [profileName, setProfileName] = React.useState('')
    const [selectedProfile, setSelectedProfile] = React.useState('')
    const profiles = readProfiles(settings.v3_controller_profiles)
    const applyProfile = (profile: ControllerProfile) => { const { name, ...values } = profile; setSettings({...settings,...values}) }
    const saveProfile = () => {
        const name = profileName.trim().slice(0,40)
        if (!name || (profiles.length >= 20 && !profiles.some(profile => profile.name === name))) return
        const next = [...profiles.filter(profile => profile.name !== name), snapshotProfile(name,settings)]
        setSettings({...settings,v3_controller_profiles:next}); setSelectedProfile(name); setProfileName('')
    }
    const [ controllerPing, setControllerPing] = React.useState(0)

    const [controllerKeys, setControllerKeys] = React.useState(settings.input_mousekeyboard_config)

    const { t } = useTranslation()

    React.useEffect(() => {
        const controllerInterval = setInterval(() => {
            setControllerPing(Date.now())
        }, 1000)

        return () => {
            clearInterval(controllerInterval)
        }
    }, [])

    function setControllerVibration(){
        setSettings({
            ...settings,
            controller_vibration: (! settings.controller_vibration),
        })
    }

    function setTouchInput(){
        setSettings({
            ...settings,
            input_touch: (! settings.input_touch),
        })
    }

    function setMKBInput(){
        setSettings({
            ...settings,
            input_mousekeyboard: (! settings.input_mousekeyboard),
        })
    }

    function setLegacyInput(){
        setSettings({
            ...settings,
            input_newgamepad: (! settings.input_newgamepad),
        })
    }

    function setKeyConfig(button:string, event) {
        let ckeys = { ...controllerKeys }
        if(ckeys === undefined) {
            ckeys = {} as any
        }


        for (const ckeysKey of Object.keys(ckeys)) {
            if(ckeys[ckeysKey] === button) delete ckeys[ckeysKey]
        }

        if (event.key !== 'Escape')
            ckeys[event.key] = button

        setControllerKeys(ckeys)

        event.target.blur()

        setSettings({
            ...settings,
            input_mousekeyboard_config: ckeys,
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.input.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.input.title')}</h1>
                    <p><label htmlFor='handheld-mode'>{t('dashboard.handheldMode')}</label><select id='handheld-mode' value={settings.handheld_mode} onChange={e => setSettings({...settings, handheld_mode: e.target.value})}><option value='auto'>{t('dashboard.preset_auto')}</option><option value='on'>{t('settings.input.enabledLabel')}</option><option value='off'>{t('settings.input.disabledLabel')}</option></select></p>
                    <p>{t('dashboard.handheldDescription')}</p>
                    <p><label htmlFor='performance-hud'>{t('dashboard.performanceHud')}</label><input id='performance-hud' type='checkbox' checked={settings.stream_performance_hud} onChange={e => setSettings({...settings, stream_performance_hud:e.target.checked})} /></p>

                    <p>
                        <label>{t('settings.input.enableVibration')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setControllerVibration } checked={settings.controller_vibration} />&nbsp; ({ settings.controller_vibration ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.input.enableTouch')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setTouchInput } checked={settings.input_touch} />&nbsp; ({ settings.input_touch ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.input.enableMouseKeyboard')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setMKBInput } checked={settings.input_mousekeyboard} />&nbsp; ({ settings.input_mousekeyboard ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label> <br />
                        { (!settings.input_newgamepad && settings.input_mousekeyboard) ? <small style={{ color: 'orange' }}>{t('settings.input.legacyWarning')}</small> : '' }
                    </p>

                    <p>
                        <label>{t('settings.input.enableLegacy')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setLegacyInput } checked={!settings.input_newgamepad} />&nbsp; ({ !settings.input_newgamepad ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label><br />
                        <small>{t('settings.input.enableLegacyDescription')}</small>
                    </p>
                </Card>

                <Card>
                    <h1>{t('settings.input.controllerDetectedTitle')}</h1>

                    <p>{t('settings.input.controllerDetectedDescription')}</p>

                    <div>
                        {
                            (typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).map((item, index) => {
                                return (
                                    <p key={ index }>
                                #{ index+1 } &nbsp;

                                        { (item) ?
                                            item.id + ' ' + t('settings.input.axesLabel') + ': ' + item.axes.length + ', ' + t('settings.input.buttonsLabel') + ': ' + item.buttons.length + ', ' + t('settings.input.rumbleLabel') + ': ' + ((item.vibrationActuator != null) ? (item.vibrationActuator as any).type : t('settings.input.notSupportedLabel'))
                                            : t('settings.input.noControllerDetected')
                                        }
                                    </p>
                                )
                            })
                        }
                    </div>
                </Card>

                <Card><h1>{t('dashboard.consoleController')}</h1><p>{t('dashboard.consoleControllerDescription')}</p><label><input type='checkbox' checked={settings.v3_console_controller} onChange={event=>setSettings({...settings,v3_console_controller:event.target.checked})}/> {t('dashboard.consoleController')}</label></Card>
                <Card hidden={settings.streaming_engine !== 'experimental'}><h1>{t('dashboard.multiController')}</h1><p>{t('dashboard.multiControllerDescription')}</p><label><input type='checkbox' checked={settings.v3_multi_controller} onChange={event=>setSettings({...settings,v3_multi_controller:event.target.checked})}/> {t('dashboard.multiController')}</label></Card>
                <ControllerTest />
                <Card hidden={settings.streaming_engine !== 'experimental'}><h1>{t('dashboard.streamShortcuts')}</h1><p>{t('dashboard.streamShortcutsHint')}</p>{(Object.keys(shortcutDefaults) as StreamAction[]).map(action=><p key={action}><label htmlFor={'stream-key-'+action}>{t('dashboard.shortcut_'+action)}</label><select id={'stream-key-'+action} value={validateShortcuts(settings.v3_stream_shortcuts)[action]} onChange={event=>setSettings({...settings,v3_stream_shortcuts:assignShortcut(settings.v3_stream_shortcuts,action,event.target.value)})}>{shortcutKeys.map(key=><option key={key} value={key}>{key||t('settings.input.disabledLabel')}</option>)}</select></p>)}<button className='btn' type='button' onClick={()=>setSettings({...settings,v3_stream_shortcuts:{...shortcutDefaults}})}>{t('dashboard.resetShortcuts')}</button></Card>
                <Card hidden={settings.streaming_engine !== 'experimental'}>
                    <h1>{t('dashboard.advancedInput')}</h1>
                    <p><label htmlFor='v3-deadzone'>{t('dashboard.deadzone')}</label><input id='v3-deadzone' type='range' min='0' max='0.5' step='0.01' value={settings.v3_deadzone} onChange={e => setSettings({...settings, v3_deadzone:Number(e.target.value)})} /> {Math.round(settings.v3_deadzone*100)}%</p>
                    <p><label htmlFor='v3-invert-y'>{t('dashboard.invertY')}</label><input id='v3-invert-y' type='checkbox' checked={settings.v3_invert_y} onChange={e => setSettings({...settings, v3_invert_y:e.target.checked})} /></p>
                    <p><label htmlFor='v3-swap-sticks'>{t('dashboard.swapSticks')}</label><input id='v3-swap-sticks' type='checkbox' checked={settings.v3_swap_sticks} onChange={e => setSettings({...settings, v3_swap_sticks:e.target.checked})} /></p>
                    <p><label htmlFor='v3-sensitivity'>{t('dashboard.mouseSensitivity')}</label><input id='v3-sensitivity' type='range' min='0.25' max='4' step='0.25' value={settings.v3_mouse_sensitivity} onChange={e => setSettings({...settings,v3_mouse_sensitivity:Number(e.target.value)})} /> {settings.v3_mouse_sensitivity}×</p>
                    <button type='button' className='btn' onClick={() => setSettings({...settings,v3_deadzone:0.08,v3_invert_y:false,v3_swap_sticks:false,v3_mouse_sensitivity:1})}>{t('dashboard.resetInput')}</button>
                    <p>{t('dashboard.inputNextStream')}</p>
                </Card>
                <Card hidden={settings.streaming_engine !== 'experimental'}>
                    <h1>{t('dashboard.controllerProfiles')}</h1>
                    <p>{t('dashboard.profileDescription')}</p>
                    <div className='gl-console-toolbar'>{Object.entries(controllerPresets).map(([key,profile]) => <button type='button' key={key} className='btn' onClick={() => applyProfile(profile)}>{t('dashboard.controllerPreset_'+key)}</button>)}</div>
                    <p><label htmlFor='controller-profile-name'>{t('dashboard.profileName')}</label><input id='controller-profile-name' className='text' maxLength={40} value={profileName} onChange={event => setProfileName(event.target.value)} /><button type='button' className='btn' disabled={!profileName.trim() || (profiles.length >= 20 && !profiles.some(profile => profile.name === profileName.trim()))} onClick={saveProfile}>{t('dashboard.saveProfile')}</button></p>
                    <p><label htmlFor='controller-profile-select'>{t('dashboard.savedProfiles')}</label><select id='controller-profile-select' value={selectedProfile} onChange={event => setSelectedProfile(event.target.value)}><option value=''>{t('dashboard.chooseProfile')}</option>{profiles.map(profile => <option key={profile.name} value={profile.name}>{profile.name}</option>)}</select><button type='button' className='btn' disabled={!profiles.some(profile => profile.name === selectedProfile)} onClick={() => { const profile = profiles.find(item => item.name === selectedProfile); if (profile) applyProfile(profile) }}>{t('dashboard.applyProfile')}</button><button type='button' className='btn' disabled={!profiles.some(profile => profile.name === selectedProfile)} onClick={() => { setSettings({...settings,v3_controller_profiles:profiles.filter(profile => profile.name !== selectedProfile)}); setSelectedProfile('') }}>{t('dashboard.deleteProfile')}</button></p>
                    <h1>{t('dashboard.controllerRemapping')}</h1>
                    <p>{t('dashboard.remappingDescription')}</p>
                    {Object.entries(validateButtonMapping(settings.v3_button_mapping)).map(([button, value]) => <p key={button}><label htmlFor={'map-' + button}>{button}</label><select id={'map-' + button} value={value} onChange={e => setSettings({...settings, v3_button_mapping:{...validateButtonMapping(settings.v3_button_mapping),[button]:e.target.value}})}>{Array.from({length:64}, (_, index) => <option key={index} value={String(index)}>{index} {Object.keys(defaultButtonMapping).find(key => defaultButtonMapping[key] === String(index)) || ''}</option>)}</select></p>)}
                    <button type='button' className='btn' onClick={() => setSettings({...settings,v3_button_mapping:{}})}>{t('dashboard.resetMapping')}</button>
                </Card>
                <Card hidden={ settings.input_newgamepad && settings.streaming_engine !== 'experimental' }>
                    <h1>{t('settings.input.keyboardMappingsTitle')}</h1>
                    <p>
                        {
                            <KeySettings keyConfigs={controllerKeys} setKeyConfig={setKeyConfig} />
                        }
                    </p>
                </Card>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsInput
