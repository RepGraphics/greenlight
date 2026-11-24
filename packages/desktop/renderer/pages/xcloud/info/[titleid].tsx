import React from 'react'
import { useSettings } from '../../../context/userContext'
import { readGameProfiles } from '../../../lib/gameprofiles'
import type { GameProfile } from '../../../lib/gameprofiles'
import { readProfiles } from '../../../lib/controllerprofiles'
import Head from 'next/head'
import Ipc from '../../../lib/ipc'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import BreadcrumbBar from '../../../components/ui/breadcrumbbar'
import Button from '../../../components/ui/button'
import Loader from '../../../components/ui/loader'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'



function xCloudInfo() {
    const router = useRouter()
    const { settings, setSettings } = useSettings()
    const titleId = typeof router.query.titleid === 'string' ? router.query.titleid : ''
    const productDetails = useQuery('xcloudinfo_titleId_'+titleId, () => Ipc.send('xCloud', 'getTitle', { titleId }), { staleTime: 10*1000, enabled: router.isReady && Boolean(titleId) })
    const productName = productDetails.data?.catalogDetails?.ProductTitle || titleId || '...'
    const profiles = readGameProfiles(settings.v3_game_profiles)
    const stored = profiles.find(profile => profile.titleId === titleId)
    const profile: GameProfile = stored || { titleId, title: productName, bitrate: null, renderer:'default', controllerProfile:'' }
    const updateProfile = (patch: Partial<GameProfile>) => { if (!titleId || (!stored && profiles.length >= 100)) return; setSettings({...settings,v3_game_profiles:readGameProfiles([...profiles.filter(item => item.titleId !== titleId), {...profile,...patch,titleId,title:productName}])}) }
    const { t } = useTranslation()
    const hasEntitlement = productDetails.data?.hasEntitlement !== false


    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.titleInfo.pageTitle')} { router.query.titleid }</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">{t('page.titleInfo.breadcrumb1')}</Link>
                <Link href="/xcloud/library">{t('page.titleInfo.breadcrumb2')}</Link>
                <Link href={ '/xcloud/info/'+router.query.titleid }>{productName}</Link>
            </BreadcrumbBar>

            {productDetails.isError ? <p role='alert'>{t('dashboard.gameDetailsFailed')} <button className='btn' onClick={() => productDetails.refetch()}>{t('dashboard.retryStream')}</button></p> : !productDetails.data?.catalogDetails ? <React.Fragment><Loader></Loader></React.Fragment> : <React.Fragment>
                <div id="page_info_background" style={{
                    background: 'linear-gradient(0deg, rgba(26,27,30,0.7) 0%, rgba(26,27,30,0.7) 90%, rgba(26,27,30,0.7) 100%), url(https:'+ productDetails.data.catalogDetails.Image_Hero?.URL +')',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'cover',
                }}></div>

                <div id="page_info_titleid">

                    <div id="page_info_hero">
                        <h1>{productName}</h1>
                        <h2>{t('page.titleInfo.by')} { productDetails.data.catalogDetails.PublisherName }</h2>
                    </div>

                    <div id="page_info_titleid_sidebar">
                        <Image src={ 'https:'+productDetails.data.catalogDetails.Image_Poster?.URL } alt={productName} width={ 640/4 } height={ 960/4 } /><br />
                        <br />

                        {hasEntitlement ? <Link href={ '/stream/xcloud_'+router.query.titleid }>
                            <Button label={ t('page.titleInfo.startStreamBtn') } className='btn-primary'></Button>
                        </Link> : <Button label={ t('page.titleInfo.purchaseRequiredBtn') } className='btn-primary' disabled={true}></Button>}
                    </div>

                    <div id="page_info_titleid_content">
                        <h3>{t('dashboard.gameStreamProfile')}</h3>
                        <p>{t('dashboard.gameProfileDescription')}</p>
                        <p><label htmlFor='game-bitrate'>{t('dashboard.qualityPresets')}</label><select id='game-bitrate' value={profile.bitrate === null ? 'default' : String(profile.bitrate)} onChange={event => updateProfile({bitrate:event.target.value === 'default' ? null : Number(event.target.value)})}><option value='default'>{t('dashboard.useGlobalSettings')}</option>{[0,4096,10240,20480,40960].map(value => <option key={value} value={value}>{value === 0 ? t('settings.streaming.unlimitedLabel') : Math.round(value/1024)+' Mbps'}</option>)}</select></p>
                        <p><label htmlFor='game-resolution'>{t('dashboard.requestedResolution')}</label><select id='game-resolution' value={profile.resolution ?? 'default'} onChange={event=>updateProfile({resolution:event.target.value==='720'?720:event.target.value==='1080'?1080:null})}><option value='default'>{t('dashboard.useGlobalSettings')}</option><option value='720'>720p</option><option value='1080'>1080p</option></select></p>
                        <p><label htmlFor='game-renderer'>{t('dashboard.v3Renderer')}</label><select id='game-renderer' value={profile.renderer} onChange={event => updateProfile({renderer:event.target.value as GameProfile['renderer']})}><option value='default'>{t('dashboard.useGlobalSettings')}</option><option value='video'>{t('dashboard.standardVideo')}</option><option value='webgpu'>WebGPU</option></select></p>
                        <p><label htmlFor='game-controller'>{t('dashboard.controllerProfiles')}</label><select id='game-controller' value={profile.controllerProfile} onChange={event => updateProfile({controllerProfile:event.target.value})}><option value=''>{t('dashboard.useGlobalSettings')}</option>{readProfiles(settings.v3_controller_profiles).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></p>
                        {stored && <button className='btn' onClick={() => setSettings({...settings,v3_game_profiles:profiles.filter(item => item.titleId !== titleId)})}>{t('dashboard.resetGameProfile')}</button>}
                        <h3>{t('page.titleInfo.descriptionTitle')}</h3>

                        <p>
                            { productDetails.data.catalogDetails.ProductDescriptionShort }
                        </p>

                        <h3>{t('page.titleInfo.capabilitiesTitle')}</h3>

                        <div>
                            {(productDetails.data.catalogDetails.Attributes || []).map((item) => {
                                if(item.LocalizedName === '')
                                    return

                                return <span className='page_info_pill' id={ item.Name } key={item.Name }>{item.LocalizedName}</span>
                            })}
                        </div>
                    </div>
                </div>
            </React.Fragment>}

        </React.Fragment>
    )
}

export default xCloudInfo
