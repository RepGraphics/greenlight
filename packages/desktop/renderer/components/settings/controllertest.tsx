import React from 'react'
import Card from '../ui/card'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'
import { recommendDeadzone } from '../../lib/controllercalibration'
import { ButtonCapture, captureButtonMapping } from '../../lib/controllerbinding'
import { defaultButtonMapping } from '../../../../player/src/client/lib/input/mapping'

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
    const [bindingTarget,setBindingTarget]=React.useState('A')
    const [bindingState,setBindingState]=React.useState<'idle'|'waiting'|'ambiguous'|'ready'|'failed'>('idle')
    const [bindingIndex,setBindingIndex]=React.useState<number|null>(null)
    const binding=React.useRef<{index:number;id:string;end:number;capture:ButtonCapture}|null>(null)
    const cancelBinding=()=>{binding.current=null;setBindingState('idle');setBindingIndex(null)}
    const calibration=React.useRef<{index:number;id:string;end:number;samples:number[][]}|null>(null)
    const pad=pads.find(item=>item.index===selected)||pads[0]
    const stop=()=>{cancelBinding();calibration.current=null;setRemaining(0);setRecommendation(null);setFailed(false)}
    React.useEffect(()=>{
        if(!enabled)return
        const tick=()=>{
            const current=Array.from(navigator.getGamepads?.()||[]).filter((item):item is Gamepad=>item!==null&&item.connected).map(item=>({index:item.index,id:item.id,mapping:item.mapping,axes:Array.from(item.axes),buttons:item.buttons.map(button=>button.value)}))
            setPads(current)
            const listen=binding.current
            if(listen){
                const active=current.find(item=>item.index===listen.index&&item.id===listen.id)
                if(!active||document.hidden||!document.hasFocus()||performance.now()>=listen.end){binding.current=null;setBindingState('failed')}
                else{
                    const result=listen.capture.sample(active.buttons)
                    if(result.kind==='captured'){binding.current=null;setBindingIndex(result.index);setBindingState('ready')}
                    else setBindingState(result.kind==='ambiguous'?'ambiguous':'waiting')
                }
            }
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
        return()=>{clearInterval(timer);calibration.current=null;binding.current=null}
    },[enabled])
    const startBinding=()=>{
        if(!pad||remaining>0||document.hidden||!document.hasFocus())return
        setBindingIndex(null);setBindingState('waiting')
        binding.current={index:pad.index,id:pad.id,end:performance.now()+10000,capture:new ButtonCapture(pad.buttons)}
    }
    const begin=()=>{cancelBinding();if(!pad||pad.mapping!=='standard'||pad.axes.length<4)return;setFailed(false);setRecommendation(null);setRemaining(3);calibration.current={index:pad.index,id:pad.id,end:performance.now()+3000,samples:[]}}
    const deadzone=Number.isFinite(settings.v3_deadzone)?Math.max(0,Math.min(0.5,settings.v3_deadzone)):0.08
    return <Card><h1>{t('dashboard.controllerTest')}</h1><p>{t('dashboard.controllerTestDescription')}</p><button className='btn' type='button' aria-pressed={enabled} onClick={()=>{stop();setEnabled(!enabled)}}>{t(enabled?'dashboard.stopControllerTest':'dashboard.startControllerTest')}</button>
        {enabled&&(!pad?<p>{t('settings.input.noControllerDetected')}</p>:<>
            <p><label htmlFor='test-pad'>{t('dashboard.controllerTest')}</label><select id='test-pad' value={pad.index} onChange={event=>{stop();setSelected(Number(event.target.value))}}>{pads.map(item=><option key={item.index} value={item.index}>{item.index+1}: {item.id}</option>)}</select></p>
            {pad.mapping==='standard'&&pad.axes.length>=4?<><div className='gl-stick-grid'><Stick x={pad.axes[0]} y={pad.axes[1]} deadzone={deadzone} label={t('dashboard.leftStick')}/><Stick x={pad.axes[2]} y={pad.axes[3]} deadzone={deadzone} label={t('dashboard.rightStick')}/></div><div className='gl-trigger-test'><label>LT <meter min={0} max={1} value={pad.buttons[6]??0}/></label><label>RT <meter min={0} max={1} value={pad.buttons[7]??0}/></label></div><p>{t('dashboard.calibrationInstructions')}</p><button className='btn' type='button' disabled={remaining>0||bindingState==='waiting'||bindingState==='ambiguous'} onClick={begin}>{remaining>0?remaining+'s':t('dashboard.calibrateDeadzone')}</button>{failed&&<p role='status'>{t('dashboard.calibrationFailed')}</p>}{recommendation!==null&&<p>{t('dashboard.calibrationResult',{value:Math.round(recommendation*100)})} <button className='btn' type='button' onClick={()=>{setSettings({...settings,v3_deadzone:recommendation});setRecommendation(null)}}>{t('dashboard.applyProfile')}</button></p>}</>:<p>{t('dashboard.nonstandardController')}</p>}
            <h2>{t('dashboard.controllerBindTitle')}</h2>
            <p>{t('dashboard.controllerBindHint')}</p>
            <p><label htmlFor='controller-bind-target'>{t('dashboard.controllerBindTarget')}</label><select id='controller-bind-target' value={bindingTarget} disabled={remaining>0||bindingState==='waiting'||bindingState==='ambiguous'} onChange={event=>{cancelBinding();setBindingTarget(event.target.value)}}>{Object.keys(defaultButtonMapping).map(key=><option key={key} value={key}>{key}</option>)}</select></p>
            <div className='gl-console-toolbar'><button type='button' className='btn' disabled={remaining>0||bindingState==='waiting'||bindingState==='ambiguous'} onClick={startBinding}>{t('dashboard.controllerBindStart')}</button><button type='button' className='btn' disabled={bindingState==='idle'} onClick={cancelBinding}>{t('dashboard.cancelBackup')}</button></div>
            {bindingState==='waiting'&&<p role='status'>{t('dashboard.controllerBindWaiting')}</p>}
            {bindingState==='ambiguous'&&<p role='status'>{t('dashboard.controllerBindAmbiguous')}</p>}
            {bindingState==='failed'&&<p role='status'>{t('dashboard.controllerBindFailed')}</p>}
            {bindingState==='ready'&&bindingIndex!==null&&<p role='status'>{t('dashboard.controllerBindResult',{target:bindingTarget,index:bindingIndex})} <button className='btn btn-primary' type='button' onClick={()=>{setSettings({...settings,v3_button_mapping:captureButtonMapping(settings.v3_button_mapping,bindingTarget,bindingIndex)});cancelBinding()}}>{t('dashboard.applyProfile')}</button></p>}
            <div className='gl-button-test'>{pad.buttons.map((value,index)=><span key={index} className={value>0.5?'active':''}>{index}: {value.toFixed(2)}</span>)}</div>
            <div className='gl-button-test'>{pad.axes.map((value,index)=><span key={index}>Axis {index}: {value.toFixed(3)}</span>)}</div>
        </>)}
    </Card>
}
