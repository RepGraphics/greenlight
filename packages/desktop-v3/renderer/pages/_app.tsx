import type { AppProps } from 'next/app'
import { TrpcProviderComponent } from '../providers/trpc'
import { AuthProvider } from '../contexts/AuthContext'
import { StreamPreferencesProvider } from '../contexts/StreamPreferencesContext'
import App from './app'


import '../styles/globals.css'
import '../styles/v3-shell.css'

function GreenlightDesktop({ Component, pageProps }: AppProps) {

  return (
    <TrpcProviderComponent>
      <AuthProvider>
        <StreamPreferencesProvider>
          <App>
            <Component {...pageProps} />
          </App>
        </StreamPreferencesProvider>
      </AuthProvider>
    </TrpcProviderComponent>
  );
}

export default GreenlightDesktop
