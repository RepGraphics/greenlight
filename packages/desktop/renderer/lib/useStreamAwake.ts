import { useEffect } from 'react'
import Ipc from './ipc'
export function useStreamAwake(session:string,enabled:boolean){
    useEffect(()=>{
        if(!session||!enabled||typeof window==='undefined'||!window.Greenlight||window.Greenlight.isWebUI())return
        let disposed=false
        let pending=false
        const renew=async()=>{if(disposed||pending)return;pending=true;try{await Ipc.send('streaming','setStreamAwake',{sessionId:session,enabled:true})}catch{}finally{pending=false;if(disposed)void Ipc.send('streaming','setStreamAwake',{sessionId:session,enabled:false}).catch(()=>{})}}
        void renew()
        const timer=setInterval(renew,15000)
        return()=>{disposed=true;clearInterval(timer);void Ipc.send('streaming','setStreamAwake',{sessionId:session,enabled:false}).catch(()=>{})}
    },[session,enabled])
}
