import React from 'react'
import { inspectRenderingCapabilities, type RenderingCapabilities } from '../../lib/renderingcapabilities'
import Head from 'next/head'
import Ipc from '../../lib/ipc'
import Card from '../../components/ui/card'
import SettingsSidebar from '../../components/settings/sidebar'
import { useTranslation } from 'react-i18next'

function SettingsDebug() {
    const { t } = useTranslation()
    const [appDebug, setAppDebug] = React.useState([])
    const [rendering, setRendering] = React.useState<RenderingCapabilities | null>(null)
    const refreshRendering = () => setRendering(inspectRenderingCapabilities({
        matchMedia: typeof window.matchMedia === 'function' ? query => window.matchMedia(query) : undefined,
        webGpu: 'gpu' in navigator,
        codecs: typeof RTCRtpReceiver !== 'undefined' ? () => RTCRtpReceiver.getCapabilities?.('video')?.codecs : undefined,
    }))
    React.useEffect(() => { refreshRendering() }, [])
    const capability = (value: boolean | null) => t(value === null ? 'renderingDiagnostics.unknown' : value ? 'renderingDiagnostics.reported' : 'renderingDiagnostics.notReported')

    React.useEffect(() => {
        if(appDebug.length === 0){
            Ipc.send('app', 'debug').then((debug) => {
                setAppDebug(debug)
            })
        }
    })

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.debug.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <div id="page_settings_debug_application">
                    <Card>
                        <h1>{t('renderingDiagnostics.title')}</h1>
                        <p>{t('renderingDiagnostics.notice')}</p>
                        {rendering && <ul className="kv-list">
                            <li><label>{t('renderingDiagnostics.displayHdr')}</label>{capability(rendering.displayHdr)}</li>
                            <li><label>{t('renderingDiagnostics.videoHdr')}</label>{capability(rendering.videoHdr)}</li>
                            <li><label>{t('renderingDiagnostics.wideGamut')}</label>{capability(rendering.wideGamut)}</li>
                            <li><label>{t('renderingDiagnostics.webGpu')}</label>{capability(rendering.webGpuApi)}</li>
                            <li><label>{t('renderingDiagnostics.codecs')}</label>{rendering.codecs?.join(', ') || t('renderingDiagnostics.unknown')}</li>
                        </ul>}
                        <button type="button" onClick={refreshRendering}>{t('renderingDiagnostics.refresh')}</button>
                    </Card>
                    {
                        appDebug.map((item) => {
                            return (
                                <Card key={ item.name }>
                                    <h1>{ item.name }</h1>
                                    <ul className="kv-list">
                                        { item.data.map((dataItem, dataIndex) => {
                                            return (
                                                <li key={ item.name+'_'+dataIndex }>
                                                    <label>{dataItem.name}{ dataItem.name.length > 0 ? ':' : '' }</label>

                                                    {dataItem.value}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </Card>
                            )
                        })
                    }
                </div>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsDebug
