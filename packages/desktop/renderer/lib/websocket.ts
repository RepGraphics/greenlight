type Listener = (event: any, data: any) => void

export default class WebsocketIPC {
    private socket: WebSocket
    private nextId = 0
    private pending = new Map<number, { channel: string; action: string; resolve: (value: any) => void; reject: (reason: any) => void; timer: ReturnType<typeof setTimeout> }>()
    private listeners = new Map<Listener, { channel: string; action?: string }>()

    constructor(url: string) {
        this.socket = new WebSocket(url)
        this.socket.addEventListener('message', event => this.onMessage(event))
        this.socket.addEventListener('close', () => this.failPending())
        this.socket.addEventListener('error', () => this.failPending())
    }

    private failPending() {
        for (const [id, request] of this.pending) {
            clearTimeout(request.timer)
            request.reject(new Error('WebUI connection closed'))
            this.pending.delete(id)
        }
    }

    send(channel: string, action: string, data: any) {
        return new Promise((resolve, reject) => {
            const id = ++this.nextId
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error('WebUI request timed out'))
            }, 60000)
            this.pending.set(id, { channel, action, resolve, reject, timer })
            const send = () => {
                if (!this.pending.has(id)) return
                try { this.socket.send(JSON.stringify({ channel, action, id, data })) }
                catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error) }
            }
            if (this.socket.readyState === WebSocket.OPEN) send()
            else if (this.socket.readyState === WebSocket.CONNECTING) this.socket.addEventListener('open', send, { once: true })
            else { clearTimeout(timer); this.pending.delete(id); reject(new Error('WebUI connection closed')) }
        })
    }

    on(channel: string, listener: Listener) {
        this.listeners.set(listener, { channel })
        return listener
    }

    onAction(channel: string, action: string, listener: Listener) {
        this.listeners.set(listener, { channel, action })
        return listener
    }

    removeListener(channel: string, listener: Listener) {
        if (this.listeners.get(listener)?.channel === channel) this.listeners.delete(listener)
    }

    onMessage(event: MessageEvent) {
        let message
        try { message = JSON.parse(event.data) } catch { return }
        if (!message || typeof message !== 'object') return
        const request = this.pending.get(message.id)
        if (request && request.channel === message.channel && request.action === message.action) {
            clearTimeout(request.timer)
            this.pending.delete(message.id)
            if (message.error !== undefined) request.reject(message.error)
            else request.resolve(message.data)
            return
        }
        for (const [listener, filter] of this.listeners) {
            if (filter.channel === message.channel && (!filter.action || filter.action === message.action)) listener(message, message.data)
        }
    }
}
