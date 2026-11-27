import type Channel from '../channel'
import {decodeMessageDialog,type StreamMessage} from './protocol'

type TransactionMessage=Exclude<StreamMessage,{type:'HandshakeAck'}>

export default class MessageHandler {
    constructor(private channel:Pick<Channel,'send'|'getPlayer'>, data:TransactionMessage, private ask:(message:string)=>boolean=message=>confirm(message)) {
        this.handle(data)
    }

    private handle(data:TransactionMessage) {
        switch(data.target){
            case '/streaming/sessionLifetimeManagement/serverInitiatedDisconnect':
                this.channel.getPlayer().serverDisconnected=true
                this.completeTransaction(data.id,'')
                break
            case '/streaming/systemUi/messages/ShowMessageDialog':
                this.handleMessage(data)
                break
            // Title updates, touch layout hints and unrecognized transactions
            // require no action. Do not log raw remote message content.
        }
    }

    private completeTransaction(id:string,content:unknown){
        this.channel.send(JSON.stringify({type:'TransactionComplete',content:JSON.stringify(content),id,cv:''}))
    }

    private handleMessage(data:TransactionMessage){
        const dialog=decodeMessageDialog(data.content)
        let accepted=false
        if(dialog){
            try{accepted=this.ask(dialog.title+'\n\n'+dialog.body)}catch{/* Unavailable browser dialog: decline. */}
        }
        // Malformed or unavailable dialogs are declined rather than throwing
        // or leaving the remote transaction awaiting an answer.
        this.completeTransaction(data.id,{Result:accepted?0:1})
    }
}
