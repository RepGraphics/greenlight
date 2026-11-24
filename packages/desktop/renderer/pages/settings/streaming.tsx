import React from 'react'
import Head from 'next/head'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Ipc from '../../lib/ipc'

import { useTranslation } from 'react-i18next'

import { useSettings } from '../../context/userContext'


function SettingsStreaming() {
    const { settings, setSettings} = useSettings()
    const { t } = useTranslation()

    const presets = [{ key: 'auto', bitrate: 0 }, { key: 'dataSaver', bitrate: 4096 }, { key: 'balanced', bitrate: 10240 }, { key: 'highQuality', bitrate: 20480 }]
    const activePreset = presets.find(preset => settings.xhome_bitrate === preset.bitrate && settings.xcloud_bitrate === preset.bitrate)
    function applyPreset(bitrate: number) {
        setSettings({ ...settings, xhome_bitrate: bitrate, xcloud_bitrate: bitrate })
    }

    function setxCloudBitrate(e){
        console.log('Set xCloud bitrate to:', e.target.value)
        setSettings({
            ...settings,
            xcloud_bitrate: parseInt(e.target.value),
        })
    }

    function setxHomeBitrate(e){
        console.log('Set xHome bitrate to:', e.target.value)
        setSettings({
            ...settings,
            xhome_bitrate: parseInt(e.target.value),
        })
    }

    function setShowNonEntitled(e){
        setSettings({
            ...settings,
            xcloud_show_non_entitled: e.target.checked,
        })
    }

    function setVideoProfile(profile){
        console.log('Set video profile to:', profile)
        setSettings({
            ...settings,
            video_profiles: (profile !== '') ? [profile] : [],
        })
    }

    // video_profiles ([])

    function setPreferredGameLanguage(e){
        setSettings({
            ...settings,
            preferred_game_language: e,
        })

        Ipc.send('app', 'setPreferredGameLanguage', { language: e }).then((res) => {
            console.log('Set preferred game language:', res)
        })
    }

    function setForceRegionIp(e){
        setSettings({
            ...settings,
            force_region_ip: e,
        })

        Ipc.send('app', 'setForceRegionIp', { ip: e }).then((res) => {
            console.log('Set force region IP:', res)
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.streaming.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.streaming.title')}</h1>

                    <p>{t('settings.streaming.description')}</p>
                    <p><label htmlFor='stream-engine'>{t('dashboard.streamingEngine')}</label><select id='stream-engine' value={settings.streaming_engine} onChange={e => setSettings({...settings, streaming_engine:e.target.value})}><option value='legacy'>{t('dashboard.legacyPlayer')}</option><option value='experimental'>{t('dashboard.experimentalPlayer')}</option></select></p><p>{t('dashboard.experimentalWarning')}</p>
                    {settings.streaming_engine === 'experimental' && <><p><label htmlFor='v3-renderer'>{t('dashboard.v3Renderer')}</label><select id='v3-renderer' value={settings.v3_renderer} onChange={e => setSettings({...settings,v3_renderer:e.target.value})}><option value='video'>{t('dashboard.standardVideo')}</option><option value='webgpu'>WebGPU (experimental)</option></select></p><p>{t('dashboard.rendererDescription')}</p><p><label htmlFor='v3-mkb'>{t('dashboard.nativeMkb')}</label><input id='v3-mkb' type='checkbox' checked={settings.v3_native_mkb} onChange={e => setSettings({...settings,v3_native_mkb:e.target.checked})} /></p><p>{t('dashboard.nativeMkbHint')}</p></>}
                    <p><label htmlFor='auto-reconnect'>{t('dashboard.autoRecovery')}</label><input id='auto-reconnect' type='checkbox' checked={settings.v3_auto_reconnect} onChange={event=>setSettings({...settings,v3_auto_reconnect:event.target.checked})}/></p><p>{t('dashboard.autoRecoveryPreference')}</p>
                    <h2>{t('dashboard.requestedResolution')}</h2><p>{t('dashboard.resolutionHint')}</p>
                    <p><label htmlFor='home-resolution'>{t('dashboard.homeResolution')}</label><select id='home-resolution' value={settings.xhome_resolution} onChange={e=>setSettings({...settings,xhome_resolution:Number(e.target.value)})}><option value={720}>720p</option><option value={1080}>1080p</option></select></p>
                    <p><label htmlFor='cloud-resolution'>{t('dashboard.cloudResolution')}</label><select id='cloud-resolution' value={settings.xcloud_resolution} onChange={e=>setSettings({...settings,xcloud_resolution:Number(e.target.value)})}><option value={720}>720p</option><option value={1080}>1080p</option></select></p>
                    <h2>{t('dashboard.qualityPresets')}</h2><p>{t('dashboard.presetDescription')}</p>
                    <div className='gl-quality-presets'>{presets.map(preset => <button type='button' key={preset.key} className={'gl-quality-preset ' + (activePreset?.key === preset.key ? 'selected' : '')} aria-pressed={activePreset?.key === preset.key} onClick={() => applyPreset(preset.bitrate)}><strong>{t('dashboard.preset_' + preset.key)}</strong><span>{preset.bitrate ? Math.floor(preset.bitrate / 1024) + ' ' + t('settings.streaming.mbpsLabel') : t('settings.streaming.unlimitedLabel')}</span></button>)}</div>
                    {!activePreset && <p>{t('dashboard.customQuality')}</p>}
                    <p>

                        <label>{t('settings.streaming.xCloudStreamingBitrateLabel')}</label>
                        <input type="range" min="0" max="40960" step="1024" value={settings.xcloud_bitrate} onChange={ setxCloudBitrate } />
                ({ settings.xcloud_bitrate === 0 ? t('settings.streaming.unlimitedLabel') : Math.floor(settings.xcloud_bitrate / 1024) + ' ' + t('settings.streaming.mbpsLabel') })
                    </p>
                    <p>
                        <label>{t('settings.streaming.xHomeStreamingBitrateLabel')}</label>
                        <input type="range" min="0" max="40960" step="1024" value={settings.xhome_bitrate} onChange={ setxHomeBitrate } />
                ({ settings.xhome_bitrate === 0 ? t('settings.streaming.unlimitedLabel') : Math.floor(settings.xhome_bitrate / 1024) + ' ' + t('settings.streaming.mbpsLabel') })
                    </p>

                    <p>
                        <label>{t('settings.streaming.showNonEntitledLabel')}</label>
                        <input type='checkbox' checked={settings.xcloud_show_non_entitled} onChange={setShowNonEntitled} />
                    </p>

                    <p>
                        <label>{t('settings.streaming.setH264ProfileLabel')}</label>
                        <select value={ (settings.video_profiles.length > 0) ? settings.video_profiles[0] : '' } onChange={ (e) => setVideoProfile(e.target.value) }>
                            <option value="">{t('settings.streaming.setH264ProfileValueAuto')}</option>
                            <option value="4d">{t('settings.streaming.setH264ProfileValueHigh')}</option>
                            <option value="42e">{t('settings.streaming.setH264ProfileValueMedium')}</option>
                            <option value="420">{t('settings.streaming.setH264ProfileValueLow')}</option>
                        </select>
                    </p>

                </Card>

                <Card>
                    <h1>{t('settings.streaming.forceRegionTitle')}</h1>
                    <p>

                        <label>{t('settings.streaming.setRegionLabel')}</label>
                        <select value={ settings.force_region_ip || '' } onChange={ (e) => setForceRegionIp(e.target.value) }>
                            <option value="">{t('settings.streaming.setRegionValueDisabled')}</option>
                            <option value="203.41.44.20">{t('settings.streaming.setRegionValueAustralia')}</option>
                            <option value="200.221.11.101">{t('settings.streaming.setRegionValueBrazil')}</option>
                            <option value="194.25.0.68">{t('settings.streaming.setRegionValueEurope')}</option>
                            <option value="122.1.0.154">{t('settings.streaming.setRegionValueJapan')}</option>
                            <option value="203.253.64.1">{t('settings.streaming.setRegionValueKorea')}</option>
                            <option value="4.2.2.2">{t('settings.streaming.setRegionValueUS')}</option>
                        </select>
                    </p>
                    <p>
                        <label>{t('settings.streaming.preferredGameLanguageLabel')}</label>
                        {(() => {
                            const languages = [
                                { code: "ar-SA", label: t('settings.streaming.preferredGameLanguageValueArabic') },
                                { code: "cs-CZ", label: t('settings.streaming.preferredGameLanguageValueCzech') },
                                { code: "da-DK", label: t('settings.streaming.preferredGameLanguageValueDanish') },
                                { code: "de-DE", label: t('settings.streaming.preferredGameLanguageValueGerman') },
                                { code: "el-GR", label: t('settings.streaming.preferredGameLanguageValueGreek') },
                                { code: "en-GB", label: t('settings.streaming.preferredGameLanguageValueEnglishUK') },
                                { code: "en-US", label: t('settings.streaming.preferredGameLanguageValueEnglishUS') },
                                { code: "es-ES", label: t('settings.streaming.preferredGameLanguageValueSpanish') },
                                { code: "es-MX", label: t('settings.streaming.preferredGameLanguageValueSpanishMX') },
                                { code: "fi-FI", label: t('settings.streaming.preferredGameLanguageValueFinnish') },
                                { code: "fr-FR", label: t('settings.streaming.preferredGameLanguageValueFrench') },
                                { code: "he-IL", label: t('settings.streaming.preferredGameLanguageValueHebrew') },
                                { code: "hu-HU", label: t('settings.streaming.preferredGameLanguageValueHungarian') },
                                { code: "it-IT", label: t('settings.streaming.preferredGameLanguageValueItalian') },
                                { code: "ja-JP", label: t('settings.streaming.preferredGameLanguageValueJapanese') },
                                { code: "ko-KR", label: t('settings.streaming.preferredGameLanguageValueKorean') },
                                { code: "nb-NO", label: t('settings.streaming.preferredGameLanguageValueNorwegian') },
                                { code: "nl-NL", label: t('settings.streaming.preferredGameLanguageValueDutch') },
                                { code: "pl-PL", label: t('settings.streaming.preferredGameLanguageValuePolish') },
                                { code: "pt-BR", label: t('settings.streaming.preferredGameLanguageValuePortugueseBR') },
                                { code: "pt-PT", label: t('settings.streaming.preferredGameLanguageValuePortuguese') },
                                { code: "ru-RU", label: t('settings.streaming.preferredGameLanguageValueRussian') },
                                { code: "sk-SK", label: t('settings.streaming.preferredGameLanguageValueSlovak') },
                                { code: "sv-SE", label: t('settings.streaming.preferredGameLanguageValueSwedish') },
                                { code: "tr-TR", label: t('settings.streaming.preferredGameLanguageValueTurkish') },
                                { code: "zh-CN", label: t('settings.streaming.preferredGameLanguageValueChineseCN') },
                                { code: "zh-TW", label: t('settings.streaming.preferredGameLanguageValueChineseTW') },
                            ];
                            // Sort languages alphabetically by label
                            const sortedLanguages = languages.sort((a, b) => a.label.localeCompare(b.label));
                            return (
                                <select value={settings.preferred_game_language || ''} onChange={(e) => setPreferredGameLanguage(e.target.value)}>
                                    {sortedLanguages.map(lang => (
                                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                                    ))}
                                </select>
                            );
                        })()}
                    </p>
                </Card>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsStreaming
