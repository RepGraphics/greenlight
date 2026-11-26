import React, { useState, useRef, useEffect } from 'react'
import Head from 'next/head'

import QRCode from "react-qr-code";

// import { useQueryClient } from "@tanstack/react-query";
import { RouterOutputs } from "../../utils/trpc";
import { useAuth } from '../../contexts/AuthContext';

export default function HomePage() {
  const {startAuth,verifyCode,logout}=useAuth();
  const [authFlow,setAuthFlow]=useState<RouterOutputs["auth_msal_start"]|undefined>(undefined);
  const [busy,setBusy]=useState(false);
  const [failed,setFailed]=useState(false);
  const generation=useRef(0);
  const locked=useRef(false);
  useEffect(()=>()=>{generation.current++;locked.current=false},[]);
  const start=async()=>{
    if(locked.current)return;
    locked.current=true;
    const epoch=++generation.current;
    setBusy(true);setFailed(false);setAuthFlow(undefined);
    try{
      const flow=await startAuth();
      if(epoch!==generation.current)return;
      if(!flow)throw Error('Authentication unavailable');
      setAuthFlow(flow);
      const result=await verifyCode(flow.device_code);
      if(epoch===generation.current&&!result)throw Error('Authentication unavailable');
    }catch{
      if(epoch===generation.current){setFailed(true);setAuthFlow(undefined)}
    }finally{
      if(epoch===generation.current){locked.current=false;setBusy(false)}
    }
  };
  const cancel=()=>{
    generation.current++;locked.current=false;
    logout();setAuthFlow(undefined);setBusy(false);setFailed(false);
  };

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight Authentication</title>
      </Head>
      <div className="flex h-screen bg-[#0d0d0d] bg-pattern overflow-hidden">
            {/* Main content */}
            <main className="flex-1 overflow-hidden relative">
              {/* Ambient background glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#107C10]/3 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#107C10]/2 rounded-full blur-3xl pointer-events-none" />

              {/* Main content area */}

              <div className="h-full overflow-y-auto">
                <div className="p-6 md:p-8 max-w-5xl mx-auto">
                  {/* Header */}
                  <div className="mb-6 animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-white mb-1">You need to authenticate</h2>
                    <p className="text-white/40 text-sm">Login with your xbox account to continue</p>

                    <div className="flex mt-10">
                      <div className="w-64 flex-auto">
                        <p id="login-message" role="status">{authFlow?.message||(busy?'Retrieving login details…':'Start a device-code sign-in.')}</p>
                        {failed&&<p role="alert">Sign-in failed or expired. Try again.</p>}
                        {!busy&&<button type="button" onClick={()=>void start()}>Sign in with Microsoft</button>}
                        {busy&&<button type="button" onClick={cancel}>Cancel sign-in</button>}
                      </div>
                      <div className="w-64 flex-auto">
                        <p className="pb-4">
                          Or scan the QR code below with your phone to sign in.
                        </p>
                        <div className="content-center justify-items-center">
                          { (authFlow?.verification_uri && authFlow?.user_code) ? <QRCode value={`${authFlow.verification_uri}?otc=${authFlow.user_code}`} size={100} bgColor="#0d0d0d" fgColor="#ffffff" /> : ''}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* End of main content */}
            </main>
          </div>
    </React.Fragment>
  )
}
