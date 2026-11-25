import { v4 as uuidv4 } from 'uuid'

import Channel from './channel'
import MessageHandler from './message/handler'

export default class MessageChannel extends Channel {
    _handshakeCompleted = false
    private touchInputEnabled=false
    private disposed=false

    getChannelName() {
        return 'message'
    }

    getChannelConfig() {
        return {
            protocol: 'messageV1',
            ordered: true,
        }
    }

    onOpen() {
        if(this.disposed)return
        console.log('[MessageChannel] Sending handshake...')
        const handshake = JSON.stringify({
            'type':'Handshake',
            'version':'messageV1',
            'id':'be0bfc6d-1e83-4c8a-90ed-fa8601c5a179',
            'cv':'',
        })
        this.send(handshake)
    }

    onMessage(event: MessageEvent<any>) {
        if(this.disposed)return
        let data: any
        try { data = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)) } catch { return }
        if (!data || typeof data.type !== 'string') return
        // console.log('[MessageChannel] received:', data)

        switch(data.type){
            case 'HandshakeAck':
                if (this._handshakeCompleted) return
                console.log('[MessageChannel] Handshake completed')
                this._handshakeCompleted = true
                // Start control & input channels
                this.getPlayer()._channels.control.sendAuthorization()
                this.getPlayer()._channels.input.start()
                this.sendConfig()
                break

            case 'TransactionStart':
            case 'Message':
                new MessageHandler(this, data)
                break

            default:
                console.log('[MessageChannel] Unhandled message type:', data.type, data)
        }

    }

    sendConfig(){
        const systemUis = []
        const systemVersion = [0, 1, 0]
        const uiConfig = JSON.stringify(this.generateMessage('/streaming/systemUi/configuration', {
            'version': systemVersion,
            'systemUis': systemUis, // Xbox Windows app has [33], xCloud has [10,19,31,27,32,-41]
            
            // 8 = unknown
            // 10 = ShowVirtualKeyboard
            // 13 = unknown
            // 15 = unknown
            // 19 = ShowMessageDialog
            // 31 = ShowApplication
            // 27 = ShowPurchase
            // 32 = ShowTimerExtensions
            // 33 = Xbox windows app, disables the nexus menu on xCloud (Alt nexus menu?)
            // -44 = unknown
            // 40 = unknown
            // 41 = unknown
            // -43 = unknown

            // Possible options: Keyboard, PurchaseModal
        }))
        this.send(uiConfig)

        const clientConfig = JSON.stringify(this.generateMessage('/streaming/properties/clientappinstallidchanged', { 'clientAppInstallId': 'c97d7ee0-73b2-4239-bf1d-9d805a338429' }))
        this.send(clientConfig)

        const orientationConfig = JSON.stringify(this.generateMessage('/streaming/characteristics/orientationchanged', { 'orientation': 0 }))
        this.send(orientationConfig)

        this.sendTouchConfiguration()

        const deviceConfig = JSON.stringify(this.generateMessage('/streaming/characteristics/clientdevicecapabilities', {}))
        this.send(deviceConfig)

        const dimensionsConfig = JSON.stringify(this.generateMessage('/streaming/characteristics/dimensionschanged', {
            'horizontal': 1920,
            'vertical': 1080,
            'preferredWidth': 1920,
            'preferredHeight': 1080,
            'safeAreaLeft': 0,
            'safeAreaTop': 0,
            'safeAreaRight': 1920,
            'safeAreaBottom': 1080,
            'supportsCustomResolution':true,
        }))
        this.send(dimensionsConfig)
    }

    // Preserve the desired state before handshake; send changes only once
    // the existing message protocol is ready. A new player starts disabled.
    setTouchInputEnabled(enabled:boolean){
        if(this.disposed||this.touchInputEnabled===enabled)return
        this.touchInputEnabled=enabled
        if(this._handshakeCompleted&&this.isOpen())this.sendTouchConfiguration()
    }

    private sendTouchConfiguration(){
        this.send(JSON.stringify(this.generateMessage('/streaming/characteristics/touchinputenabledchanged',{
            touchInputEnabled:this.touchInputEnabled&&!this.getPlayer().consoleController,
        })))
    }

    generateMessage(path, data) {
        return {
            'type': 'Message',
            'content': JSON.stringify(data),
            'id': uuidv4(),
            'target': path,
            'cv': '',
        }
    }

    destroy() {
        this.disposed=true
        this._handshakeCompleted=false
        this.touchInputEnabled=false
    }
}