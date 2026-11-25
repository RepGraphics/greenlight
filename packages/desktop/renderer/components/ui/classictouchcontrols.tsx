import React from 'react'
import {useTranslation} from 'react-i18next'
import type {ClassicVirtualPad,StickSide} from '../../lib/classicvirtualpad'
function Stick({side,pad}:{side:StickSide;pad:ClassicVirtualPad}){
    const pointer=React.useRef<number|null>(null)
    const [position,setPosition]=React.useState({x:0,y:0})
    const move=(event:React.PointerEvent<HTMLDivElement>)=>{
        if(pointer.current!==event.pointerId)return
        const rect=event.currentTarget.getBoundingClientRect(),radius=Math.max(1,rect.width/2)
        let x=(event.clientX-rect.left-rect.width/2)/radius,y=(event.clientY-rect.top-rect.height/2)/radius
        const length=Math.max(1,Math.hypot(x,y));x/=length;y/=length
        if(pad.move(side,event.pointerId,x,y))setPosition({x,y})
    }
    const release=(id:number)=>{if(pointer.current!==id)return;pointer.current=null;pad.releaseStick(side,id);setPosition({x:0,y:0})}
    return <div className={'gl-virtual-stick gl-stick-'+side.toLowerCase()} aria-label={side+' analogue stick'} onPointerDown={event=>{
        if(pointer.current!==null||event.button!==0)return
        event.preventDefault()
        try{event.currentTarget.setPointerCapture(event.pointerId)}catch{return}
        pointer.current=event.pointerId;move(event)
    }} onPointerMove={move} onPointerUp={event=>release(event.pointerId)} onPointerCancel={event=>release(event.pointerId)} onLostPointerCapture={event=>release(event.pointerId)}><span style={{transform:'translate('+position.x*55+'%, '+position.y*55+'%)'}}/></div>
}
export default function ClassicTouchControls({pad}:{pad:ClassicVirtualPad}){
    const {t}=useTranslation()
    const [visible,setVisible]=React.useState(true)
    React.useEffect(()=>{
        const release=()=>{pad.releaseAll();setVisible(false)}
        const hidden=()=>{if(document.hidden)release()}
        window.addEventListener('blur',release);document.addEventListener('visibilitychange',hidden)
        return()=>{window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',hidden);pad.releaseAll()}
    },[pad])
    const button=(name:string,label:string)=><button key={name} type='button' aria-label={name} onPointerDown={event=>{
        if(event.button!==0)return
        event.preventDefault()
        try{event.currentTarget.setPointerCapture(event.pointerId)}catch{return}
        pad.press(event.pointerId,name)
    }} onPointerUp={event=>pad.release(event.pointerId)} onPointerCancel={event=>pad.release(event.pointerId)} onLostPointerCapture={event=>pad.release(event.pointerId)}>{label}</button>
    return <><button type='button' className='btn gl-classic-touch-launch' aria-pressed={visible} onClick={()=>{if(visible)pad.releaseAll();setVisible(!visible)}}>{t('dashboard.touchControls')}</button>{visible&&<div className='gl-touch-overlay gl-classic-touch-overlay'>
        <div className='gl-touch-shoulders'>{button('LeftTrigger','LT')}{button('LeftShoulder','LB')}{button('View','▣')}{button('Nexus','Xbox')}{button('Menu','☰')}{button('RightShoulder','RB')}{button('RightTrigger','RT')}</div>
        <div className='gl-touch-dpad'>{button('DPadUp','↑')}{button('DPadLeft','←')}{button('DPadRight','→')}{button('DPadDown','↓')}</div>
        <Stick side='Left' pad={pad}/><Stick side='Right' pad={pad}/>
        <div className='gl-touch-abxy'>{button('Y','Y')}{button('X','X')}{button('B','B')}{button('A','A')}</div>
    </div>}</>
}
