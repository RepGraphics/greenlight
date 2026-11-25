type Listener = (event: any, data: any) => void
type Pending = { channel: string; action: string; resolve: (value: any) => void; reject: (reason: any) => void; timer: ReturnType<typeof setTimeout>; payload: string; sent: boolean }

export default class WebsocketIPC {
    private socket: WebSocket
    private nextId = 0
    private pending = new Map<number, Pending>()
    private listeners = new Map<Listener, { channel: string; action?: string }>()

    constructor(private url: string) {
        this.socket = this.connect()
    }

    private connect() {
        const socket = new WebSocket(this.url)
        socket.addEventListener('open', () => {
            if (socket !== this.socket) return
            for (const [id, request] of this.pending) this.transmit(id, request, socket)
        })
        socket.addEventListener('message', event => {
            if (socket === this.socket && socket.readyState === WebSocket.OPEN) this.onMessage(event)
        })
        const failed = () => {
            if (socket !== this.socket) return
            this.failPending()
            // Do not replay uncertain mutations; the next explicit request can
            // open a fresh connection after an error or network interruption.
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close()
        }
        socket.addEventListener('close', failed)
        socket.addEventListener('error', failed)
        return socket
    }

    private failPending() {
        for (const [id, request] of this.pending) this.reject(id, request, new Error('WebUI connection closed'))
    }

    private reject(id: number, request: Pending, error: unknown) {
        clearTimeout(request.timer)
        this.pending.delete(id)
        request.reject(error)
    }

    private transmit(id: number, request: Pending, socket: WebSocket) {
        if (request.sent || !this.pending.has(id)) return
        try {
            socket.send(request.payload)
            request.sent = true
        } catch (error) { this.reject(id, request, error) }
    }

    send(channel: string, action: string, data: any) {
        return new Promise((resolve, reject) => {
            const id = ++this.nextId
            const payload = JSON.stringify({ channel, action, id, data })
            if (this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
                this.failPending()
                this.socket = this.connect()
            }
            const timer = setTimeout(() => {
                const request = this.pending.get(id)
                if (request) this.reject(id, request, new Error('WebUI request timed out'))
            }, 60000)
            const request: Pending = { channel, action, resolve, reject, timer, payload, sent: false }
            this.pending.set(id, request)
            if (this.socket.readyState === WebSocket.OPEN) this.transmit(id, request, this.socket)
            else if (this.socket.readyState !== WebSocket.CONNECTING) this.reject(id, request, new Error('WebUI connection closed'))
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
        if (Number.isSafeInteger(message.id) && message.id > 0) {
            const request = this.pending.get(message.id)
            // A mismatched, duplicate or expired response is not a broadcast.
            if (!request || !request.sent || request.channel !== message.channel || request.action !== message.action) return
            clearTimeout(request.timer)
            this.pending.delete(message.id)
            if (message.error !== undefined) request.reject(message.error)
            else request.resolve(message.data)
            return
        }
        if (typeof message.channel !== 'string' || typeof message.action !== 'string') return
        this.listeners.forEach((filter, listener) => {
            if (filter.channel === message.channel && (!filter.action || filter.action === message.action)) listener(message, message.data)
        })
    }
}
