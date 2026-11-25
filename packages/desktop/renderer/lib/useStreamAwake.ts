import { useEffect } from 'react'
import Ipc from './ipc'
import { AwakeLeaseQueue } from './awakeleasequeue'

const leases=new AwakeLeaseQueue()
export function useStreamAwake(session:string,enabled:boolean){
    useEffect(()=>{
        if(!session||!enabled||typeof window==='undefined'||!window.Greenlight||window.Greenlight.isWebUI())return
        return leases.start(session,enabled=>Ipc.send('streaming','setStreamAwake',{sessionId:session,enabled}))
    },[session,enabled])
}
