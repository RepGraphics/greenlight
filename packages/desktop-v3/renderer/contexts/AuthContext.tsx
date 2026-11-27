import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
// import { trpc } from '../trpc';
import { useQueryClient } from "@tanstack/react-query";
import { useTRPCClient, RouterOutputs } from "../utils/trpc";
import {AuthAttempt,clearLegacyUserToken} from "./authattempt";
import type {DesktopSession, DeviceCodePrompt, XboxAccount} from '../../shared/desktopcontracts';

import {emptyLibraryCollections,toggleFavorite,openLibraryTitle,type LibraryCollections} from '../utils/librarycollections';

import {emptyWebSetupPresets,rememberWebSetup,forgetWebSetup,type WebSetupMode,type WebSetupPresets,type WebSetupPreferences} from '../utils/websetuppresets';

interface AuthContextType {
  setupPresets:WebSetupPresets;
  rememberSetup:(mode:WebSetupMode,value:WebSetupPreferences)=>void;
  forgetSetup:(mode:WebSetupMode)=>void;
  libraryCollections: LibraryCollections;
  toggleLibraryFavorite: (id:string)=>void;
  rememberLibraryTitle: (id:string)=>void;
  clearLibraryCollections: ()=>void;
  startAuth: () => Promise<(DeviceCodePrompt & {device_code?: string}) | undefined>;
  verifyCode: (code?: string) => Promise<boolean>;
  openAccount: (id: string) => Promise<boolean>;
  removeAccount: (id: string) => Promise<void>;
  savedAccounts: XboxAccount[];
  activeAccount: XboxAccount | null;
  accountSaved: boolean;
  desktop: boolean;
  canSaveAccounts: boolean;
  logout: () => void;
  getWebToken: () => { uhs: string; token: string };
  getxHomeToken: () => { market: string; language: string; token: string };
  getxCloudToken: () => { market: string; language: string; token: string };
  getUserRefreshToken: () => string | undefined;
  authState?: {
    userToken: RouterOutputs["auth_msal_verify"] | null;
    webToken: RouterOutputs["auth_get_webtoken"] | null;
    streamingTokens: RouterOutputs["auth_get_streamingtokens"] | null;
  };
  isAuthenticated: boolean;
  isAuthenticating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPCClient();
  const queryClient = useQueryClient();

  const [authState, setAuthState] = useState<{
    userToken: RouterOutputs["auth_msal_verify"] | null;
    webToken: RouterOutputs["auth_get_webtoken"] | null;
    streamingTokens: RouterOutputs["auth_get_streamingtokens"] | null;
  }>({
    userToken: null,
    webToken: null,
    streamingTokens: null,
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [desktop,setDesktop]=useState(false);
  const [canSaveAccounts,setCanSaveAccounts]=useState(false);
  const [savedAccounts,setSavedAccounts]=useState<XboxAccount[]>([]);
  const [activeAccount,setActiveAccount]=useState<XboxAccount|null>(null);
  const [accountSaved,setAccountSaved]=useState(false);
  const [libraryCollections,setLibraryCollections]=useState(emptyLibraryCollections);
  const [setupPresets,setSetupPresets]=useState(emptyWebSetupPresets);
  const attempts = useRef(new AuthAttempt());
  const active = useRef<ReturnType<AuthAttempt['begin']>|null>(null);
  const verifying = useRef(false);

  useEffect(() => {
    clearLegacyUserToken(()=>window.localStorage);
    const native=window.greenlightDesktop;
    let current=true;
    setDesktop(Boolean(native));
    if (native) {
      void native.accounts.cancel().then(()=>native.accounts.list()).then(result=>{
        if(current){setSavedAccounts(result.accounts);setCanSaveAccounts(result.available)}
      }).catch(()=>{}).finally(()=>{if(current)setIsAuthenticating(false)});
    } else setIsAuthenticating(false);
    return () => { current=false; attempts.current.cancel(); active.current=null; };
  }, []);

  const syncSavedAccounts=async (isCurrent:()=>boolean)=>{
    const native=window.greenlightDesktop;
    if(!native)return;
    const list=await native.accounts.list();
    if(!isCurrent())return;
    setSavedAccounts(list.accounts);
    setCanSaveAccounts(list.available);
  };

  const acceptDesktopSession=(session:DesktopSession, isCurrent:()=>boolean)=>{
    if(!isCurrent())return false;
    setLibraryCollections(emptyLibraryCollections());
    setSetupPresets(emptyWebSetupPresets());
    setAuthState({userToken:null,webToken:session.webToken,streamingTokens:session.streamingTokens});
    setActiveAccount(session.account);
    setAccountSaved(session.saved);
    if(session.saved&&session.account){
      const account=session.account;
      setSavedAccounts(previous=>previous.some(item=>item.id===account.id)
        ?previous.map(item=>item.id===account.id?account:item):[...previous,account]);
    }
    setIsAuthenticated(true);
    void syncSavedAccounts(isCurrent).catch(()=>{});
    return true;
  };

  const startAuth = async () => {
    const attempt=attempts.current.begin();
    active.current=attempt;
    verifying.current=false;
    const native=window.greenlightDesktop;
    const flow=native?await native.accounts.start():await trpc.auth_msal_start.query(undefined,{signal:attempt.signal});
    return attempt.current()?flow:undefined;
  };

  const verifyCode = async (code?: string) => {
    const attempt=active.current;
    if(!attempt?.current()||verifying.current)return false;
    verifying.current=true;
    try {
      const native=window.greenlightDesktop;
      if(native)return acceptDesktopSession(await native.accounts.finish(),attempt.current);
      if(!code)return false;
      const userToken=await trpc.auth_msal_verify.query(code,{signal:attempt.signal});
      if(!attempt.current())return false;
      const [webToken,streamingTokens]=await Promise.all([
        trpc.auth_get_webtoken.query(userToken,{signal:attempt.signal}),
        trpc.auth_get_streamingtokens.query(userToken,{signal:attempt.signal}),
      ]);
      if(!attempt.current())return false;
      setLibraryCollections(emptyLibraryCollections());
    setSetupPresets(emptyWebSetupPresets());
      setAuthState({userToken,webToken,streamingTokens});
      setIsAuthenticated(true);
      return true;
    } finally {
      if(attempt.current())verifying.current=false;
    }
  };

  const openAccount=async (id:string)=>{
    const native=window.greenlightDesktop;
    if(!native)return false;
    const attempt=attempts.current.begin();
    active.current=null;
    return acceptDesktopSession(await native.accounts.open(id),attempt.current);
  };

  const removeAccount=async (id:string)=>{
    const native=window.greenlightDesktop;
    if(!native)return;
    const attempt=attempts.current.begin();
    active.current=null;
    await native.accounts.remove(id);
    await syncSavedAccounts(attempt.current);
  };

  const logout = () => {
    attempts.current.cancel();
    active.current=null;
    verifying.current=false;
    if(window.greenlightDesktop)void window.greenlightDesktop.accounts.cancel().catch(()=>{});
    setLibraryCollections(emptyLibraryCollections());
    setSetupPresets(emptyWebSetupPresets());
    setAuthState({userToken:null,webToken:null,streamingTokens:null});
    setIsAuthenticated(false);
    setActiveAccount(null);
    setAccountSaved(false);
    setIsAuthenticating(false);
    queryClient.clear();
    clearLegacyUserToken(()=>window.localStorage);
  };

  const getBrowserLanguage = () => {
    if(typeof navigator==='undefined')return 'en-us';
    const primaryLang = navigator.languages?.[0]?.split('-')[0] || 'en';
    const regionalVariant = navigator.languages?.find(lang => 
      lang.toLowerCase().startsWith(primaryLang + '-')
    )?.toLowerCase() || `${primaryLang}-us`;

    return regionalVariant
  }

  const getWebToken = () => {
    return {
      uhs: authState?.webToken?.data.DisplayClaims?.xui?.[0]?.uhs || '',
      token: authState?.webToken?.data.Token || '',
    }
  }

  const getxHomeToken = () => {
    return {
      market: authState.streamingTokens?.xHomeToken?.data.market || '',
      language: getBrowserLanguage() || 'en-us',
      token: authState.streamingTokens?.xHomeToken?.data.gsToken || '',
    }
  }

  const getxCloudToken = () => {
    return {
      market: authState.streamingTokens?.xCloudToken?.data.market || '',
      language: getBrowserLanguage() || 'en-us',
      token: authState.streamingTokens?.xCloudToken?.data.gsToken || '',
    }
  }

  const getUserRefreshToken = () => {
    return authState.userToken?.refresh_token;
  }

  return (
    <AuthContext.Provider
      value={{
        setupPresets,
        rememberSetup:(mode,value)=>{if(isAuthenticated)setSetupPresets(previous=>rememberWebSetup(previous,mode,value))},
        forgetSetup:mode=>setSetupPresets(previous=>forgetWebSetup(previous,mode)),
        libraryCollections,
        toggleLibraryFavorite:id=>{if(isAuthenticated)setLibraryCollections(previous=>toggleFavorite(previous,id))},
        rememberLibraryTitle:id=>{if(isAuthenticated)setLibraryCollections(previous=>openLibraryTitle(previous,id))},
        clearLibraryCollections:()=>setLibraryCollections(emptyLibraryCollections()),
        startAuth,
        verifyCode,
        openAccount,
        removeAccount,
        savedAccounts,
        activeAccount,
        accountSaved,
        desktop,
        canSaveAccounts,
        logout,
        authState,
        isAuthenticated,
        isAuthenticating,
        getWebToken,
        getxHomeToken,
        getxCloudToken,
        getUserRefreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
