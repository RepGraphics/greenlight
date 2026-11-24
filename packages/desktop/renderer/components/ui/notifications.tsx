import React from 'react'

export default function Notifications() {
    const [messages, setMessages] = React.useState<{ id: number; text: string }[]>([])
    React.useEffect(() => {
        let id = 0
        const timers = new Map<number, ReturnType<typeof setTimeout>>()
        const onError = (event: PromiseRejectionEvent) => {
            const reason = event.reason
            const message = typeof reason?.status === 'number' ? 'Request failed (HTTP ' + reason.status + '). Please try again.' : 'An application request failed. Please try again.'
            const key = ++id
            setMessages(prev => [...prev.slice(-2), { id: key, text: message }])
            timers.set(key, setTimeout(() => {
                setMessages(prev => prev.filter(item => item.id !== key))
                timers.delete(key)
            }, 6500))
        }
        window.addEventListener('unhandledrejection', onError)
        return () => {
            window.removeEventListener('unhandledrejection', onError)
            timers.forEach(timer => clearTimeout(timer))
        }
    }, [])
    return <div className="gl-notifications" aria-live="polite">
        {messages.map(item => <div className="gl-notification" key={item.id}>
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>{item.text}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setMessages(prev => prev.filter(message => message.id !== item.id))}>×</button>
        </div>)}
    </div>
}
