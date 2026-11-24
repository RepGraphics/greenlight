import React from 'react'
import Card from '../ui/card'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'
import { recommendDeadzone } from '../../lib/controllercalibration'

interface PadSnapshot { index:number; id:string; mapping:string; axes:number[]; buttons:number[] }
function Stick({x,y,deadzone,label}:{x:number;y:number;deadzone:number;label:string}) {
    const clamp=(value:number)=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0
    return <div className='gl-stick-test'><strong>{label}</strong><svg viewBox='0 0 120 120' role='img' aria-label={label}><rect x='10' y='10' width='100' height='100' rx='8' fill='none' stroke='currentColor' opacity='.4'/><rect x={60-50*deadzone} y={60-50*deadzone} width={100*deadzone} height={100*deadzone} fill='#107c10' opacity='.6'/><path d='M60 10V110 M10 60H110' stroke='currentColor' opacity='.3'/><circle cx={60+50*clamp(x)} cy={60+50*clamp(y)} r='5' fill='#9bf00b'/></svg><small>X {clamp(x).toFixed(3)} · Y {clamp(y).toFixed(3)}</small></div>
}
export default function ControllerTest(){
    const {settings,setSettings}=useSettings()
    const {t}=useTranslation()
    const [enabled,setEnabled]=React.useState(false)
    const [pads,setPads]=React.useState<PadSnapshot[]>([])
    const [selected,setSelected]=React.useState<number|null>(null)
    const [remaining,setRemaining]=React.useState(0)
    const [recommendation,setRecommendation]=React.useState<number|null>(null)
    const [failed,setFailed]=React.useState(false)
    const calibration=React.useRef<{index:number;id:string;end:number;samples:number[][]}|null>(null)
    const pad=pads.find(item=>item.index===selected)||pads[0]
    const stop=()=>{calibration.current=null;setRemaining(0);setRecommendation(null);setFailed(false)}
    React.useEffect(()=>{
        if(!enabled)return
        const tick=()=>{
            const current=Array.from(navigator.getGamepads?.()||[]).filter((item):item is Gamepad=>item!==null).map(item=>({index:item.index,id:item.id,mapping:item.mapping,axes:Array.from(item.axes),buttons:item.buttons.map(button=>button.value)}))
            setPads(current)
            const job=calibration.current
            if(!job)return
            const active=current.find(item=>item.index===job.index&&item.id===job.id)
            if(!active||document.hidden||!document.hasFocus()){calibration.current=null;setRemaining(0);setFailed(true);return}
            job.samples.push(active.axes.slice(0,4))
            const time=Math.max(0,job.end-performance.now())
            setRemaining(Math.ceil(time/1000))
            if(time===0){const result=recommendDeadzone(job.samples);calibration.current=null;setRecommendation(result);setFailed(result===null)}
        }
        tick()
        const timer=setInterval(tick,50)
        return()=>{clearInterval(timer);calibration.current=null}
    },[enabled])
    const begin=()=>{if(!pad||pad.mapping!=='standard'||pad.axes.length<4)return;setFailed(false);setRecommendation(null);setRemaining(3);calibration.current={index:pad.index,id:pad.id,end:performance.now()+3000,samples:[]}}
    const deadzone=Number.isFinite(settings.v3_deadzone)?Math.max(0,Math.min(0.5,settings.v3_deadzone)):0.08
    return <Card><h1>{t('dashboard.controllerTest')}</h1><p>{t('dashboard.controllerTestDescription')}</p><button className='btn' type='button' aria-pressed={enabled} onClick={()=>{stop();setEnabled(!enabled)}}>{t(enabled?'dashboard.stopControllerTest':'dashboard.startControllerTest')}</button>
        {enabled&&(!pad?<p>{t('settings.input.noControllerDetected')}</p>:<>
            <p><label htmlFor='test-pad'>{t('dashboard.controllerTest')}</label><select id='test-pad' value={pad.index} onChange={event=>{stop();setSelected(Number(event.target.value))}}>{pads.map(item=><option key={item.index} value={item.index}>{item.index+1}: {item.id}</option>)}</select></p>
            {pad.mapping==='standard'&&pad.axes.length>=4?<><div className='gl-stick-grid'><Stick x={pad.axes[0]} y={pad.axes[1]} deadzone={deadzone} label={t('dashboard.leftStick')}/><Stick x={pad.axes[2]} y={pad.axes[3]} deadzone={deadzone} label={t('dashboard.rightStick')}/></div><div className='gl-trigger-test'><label>LT <meter min={0} max={1} value={pad.buttons[6]??0}/></label><label>RT <meter min={0} max={1} value={pad.buttons[7]??0}/></label></div><p>{t('dashboard.calibrationInstructions')}</p><button className='btn' type='button' disabled={remaining>0} onClick={begin}>{remaining>0?remaining+'s':t('dashboard.calibrateDeadzone')}</button>{failed&&<p role='status'>{t('dashboard.calibrationFailed')}</p>}{recommendation!==null&&<p>{t('dashboard.calibrationResult',{value:Math.round(recommendation*100)})} <button className='btn' type='button' onClick={()=>{setSettings({...settings,v3_deadzone:recommendation});setRecommendation(null)}}>{t('dashboard.applyProfile')}</button></p>}</>:<p>{t('dashboard.nonstandardController')}</p>}
            <div className='gl-button-test'>{pad.buttons.map((value,index)=><span key={index} className={value>0.5?'active':''}>{index}: {value.toFixed(2)}</span>)}</div>
            <div className='gl-button-test'>{pad.axes.map((value,index)=><span key={index}>Axis {index}: {value.toFixed(3)}</span>)}</div>
        </>)}
    </Card>
}
