import Head from 'next/head'
import type {ReactNode} from 'react'
import Brand from './brand'

export default function AuthLayout({children}: {children: ReactNode}) {
    return <>
        <Head><title>Greenlight V3 — Sign in</title></Head>
        <main className="auth-screen">
            <div className="auth-layout">
                <header className="auth-intro">
                    <Brand/>
                    <h1>Stream Xbox games</h1>
                    <p>Play from your console or open your Cloud Gaming library.</p>
                </header>
                <section className="auth-panel" aria-labelledby="auth-heading">
                    {children}
                </section>
            </div>
        </main>
    </>
}
