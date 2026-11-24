import '../styles.css'

import React from 'react'
import Head from 'next/head'
import Ipc from '../lib/ipc'
import { useRouter } from 'next/router'
import DashboardInput from '../components/ui/dashboardinput'
import Notifications from '../components/ui/notifications'
import Header from '../components/header'
import Footer from '../components/footer'
import Auth from '../components/auth'
import SidebarFriends from '../components/sidebar/friends'
import '../lib/i18n'

import { GameFavouritesProvider } from '../context/gameFavourites'
import { UserProvider } from '../context/userContext'
import { LanguageProvider } from '../context/languageContext'

import {
    QueryClient,
    QueryClientProvider,
} from 'react-query'


// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }) {
    const router = useRouter()
    const onDashboardBack = React.useCallback(() => {
        if (router.pathname !== '/home' && !router.pathname.startsWith('/stream/')) void router.push('/home')
    }, [router.pathname])
    const [queryClient] = React.useState(() => new QueryClient())

    const [loggedIn, setLoginState] = React.useState(false)
    const [prevUserState, setPrevUserState] = React.useState({
        signedIn: false,
        gamertag: '',
        gamerpic: '',
        gamerscore: '',
        level: '',
    })
    // const [headerLinks, setHeaderLinks] = React.useState([])
    // const [streamingMode, setStreamingMode] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)

    React.useEffect(() => {
        Ipc.send('app', 'loadCachedUser').then((user) => {
            setPrevUserState({
                signedIn: user.signedIn,
                gamertag: user.gamertag,
                gamerpic: user.gamerpic,
                gamerscore: user.gamerscore,
                level: user.level,
            })
        })

        const authInterval = setInterval(() => {
            console.log('Requesting AuthState...')
            Ipc.send('app', 'getAuthState').then((args) => {
                console.log('Received AuthState:', args)

                if(args.isAuthenticating === true){
                    setIsLoading(true)
                    setPrevUserState({ ...prevUserState, ...args.user})

                } else if(args.isAuthenticated === true && args.user.signedIn === true){
                    clearInterval(authInterval)


                    if(loggedIn === false){
                        Ipc.send('app', 'onUiShown').then((result) => {
                            if(result.autoStream !== '')
                                setTimeout(() => {
                                    router.push('stream/'+result.autoStream)
                                }, 1000)
                        })
                    }

                    setLoginState(true)
                    setPrevUserState({ ...prevUserState, ...args.user})
                }
            })
        }, 500)


        // cleanup this component
        return () => {

            if(authInterval)
                clearInterval(authInterval)
        }
    }, [])

    // function isStreaming(){
    //     return streamingMode
    // }

    let appBody
    if(loggedIn && prevUserState.gamertag !== ''){
        appBody = (
            <React.Fragment>
                <Header gamertag={ prevUserState.gamertag } gamerpic={ prevUserState.gamerpic } level={ parseInt(prevUserState.level) } />

                <div id="app_body">
                    <div id="app_body_container">
                        <Component {...pageProps} account={prevUserState} />
                    </div>
                </div>

                <div id="app_sidebar" style={{
                    display: 'block',
                }}>
                    <SidebarFriends></SidebarFriends>
                </div>
                <Footer />
            </React.Fragment>)

    } else {
        appBody = (
            <React.Fragment>
                <Auth signedIn={ prevUserState.signedIn} gamertag={ prevUserState.gamertag } gamerpic={ prevUserState.gamerpic } gamerscore={ prevUserState.gamerscore } isLoading={ isLoading } />
            </React.Fragment>)
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight</title>
            </Head>

            <div style={ {
                background: 'radial-gradient(ellipse at top left, #17351b 0%, #171917 32%, #121212 72%)',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
                width: '100vw',
                height: '100vh',
            }}>
                <QueryClientProvider client={queryClient}>
                    <UserProvider>
                        <LanguageProvider>
                            <GameFavouritesProvider key={prevUserState.gamertag} account={prevUserState.gamertag || 'local'}>
                                {appBody}
                            </GameFavouritesProvider>
                            <DashboardInput enabled={!router.pathname.startsWith('/stream/')} onBack={onDashboardBack} />
                            <Notifications />
                        </LanguageProvider>
                    </UserProvider>
                </QueryClientProvider>
            </div>
        </React.Fragment>
    )
}