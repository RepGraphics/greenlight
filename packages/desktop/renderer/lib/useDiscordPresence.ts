import {useEffect} from 'react'
import Ipc from './ipc'
import {AwakeLeaseQueue} from './awakeleasequeue'

const leases=new AwakeLeaseQueue()
export function useDiscordPresence(session:string,enabled:boolean,appId:string){
    useEffect(()=>{
        if(!session||!enabled||!appId||typeof window==='undefined'||!window.Greenlight||window.Greenlight.isWebUI())return
        return leases.start(session,enabled=>Ipc.send('streaming','setDiscordPresence',{sessionId:session,enabled}))
    },[session,enabled,appId])
}
