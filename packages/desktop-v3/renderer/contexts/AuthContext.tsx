import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
// import { trpc } from '../trpc';
import { useQueryClient } from "@tanstack/react-query";
import { useTRPCClient, RouterOutputs } from "../utils/trpc";
import {AuthAttempt,clearLegacyUserToken} from "./authattempt";

interface AuthContextType {
  startAuth: () => Promise<RouterOutputs["auth_msal_start"] | undefined>;
  verifyCode: (code: string) => Promise<RouterOutputs["auth_msal_verify"] | undefined>;
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
  const attempts = useRef(new AuthAttempt());
  const active = useRef<ReturnType<AuthAttempt['begin']>|null>(null);
  const verifying = useRef(false);

  useEffect(() => {
    // The experimental web frontend must not persist bearer or refresh tokens.
    clearLegacyUserToken(()=>window.localStorage);
    setIsAuthenticating(false);
    return () => { attempts.current.cancel(); active.current=null; };
  }, []);

  const startAuth = async () => {
    const attempt=attempts.current.begin();
    active.current=attempt;
    verifying.current=false;
    const flow=await trpc.auth_msal_start.query(undefined,{signal:attempt.signal});
    return attempt.current()?flow:undefined;
  };

  const verifyCode = async (code: string) => {
    const attempt=active.current;
    if(!attempt?.current()||verifying.current)return;
    verifying.current=true;
    try {
      const userToken=await trpc.auth_msal_verify.query(code,{signal:attempt.signal});
      if(!attempt.current())return;
      const [webToken,streamingTokens]=await Promise.all([
        trpc.auth_get_webtoken.query(userToken,{signal:attempt.signal}),
        trpc.auth_get_streamingtokens.query(userToken,{signal:attempt.signal}),
      ]);
      if(!attempt.current())return;
      setAuthState({userToken,webToken,streamingTokens});
      setIsAuthenticated(true);
      return userToken;
    } finally {
      if(attempt.current())verifying.current=false;
    }
  };

  const logout = () => {
    attempts.current.cancel();
    active.current=null;
    verifying.current=false;
    setAuthState({userToken:null,webToken:null,streamingTokens:null});
    setIsAuthenticated(false);
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
      uhs: authState?.webToken?.data.DisplayClaims?.xui[0]?.uhs || '', // @TODO: Fix typing
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
        startAuth,
        verifyCode,
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
