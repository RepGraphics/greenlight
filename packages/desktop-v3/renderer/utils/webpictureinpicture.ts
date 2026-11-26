import {canCapture} from '../../../desktop/renderer/lib/streamcapture'

type PictureInPictureDocument=Pick<Document,'pictureInPictureEnabled'|'pictureInPictureElement'|'exitPictureInPicture'>
export class WebPictureInPicture {
    private owned:HTMLVideoElement|null=null
    private pending=false
    private disposed=false
    constructor(private document:PictureInPictureDocument){}
    state(video:HTMLVideoElement|null){
        const current=this.document.pictureInPictureElement
        const active=Boolean(video&&current===video)
        const available=active&&typeof this.document.exitPictureInPicture==='function'||
            !current&&canCapture(video)&&this.document.pictureInPictureEnabled===true&&typeof video.requestPictureInPicture==='function'&&!video.disablePictureInPicture
        return {active,available:!this.disposed&&Boolean(available),busy:this.pending}
    }
    async toggle(video:HTMLVideoElement|null){
        if(this.disposed||this.pending)return false
        if(!video||!this.state(video).available)throw Error('Picture-in-picture unavailable')
        this.pending=true
        try{
            if(this.document.pictureInPictureElement===video){
                await this.document.exitPictureInPicture()
                if(this.owned===video)this.owned=null
            }else{
                await video.requestPictureInPicture()
                if(this.document.pictureInPictureElement===video)this.owned=video
            }
            return !this.disposed
        }finally{
            this.pending=false
            if(this.disposed)await this.release()
        }
    }
    private async release(){
        const video=this.owned
        this.owned=null
        if(video&&this.document.pictureInPictureElement===video){
            try{await this.document.exitPictureInPicture()}catch{/* Browser may already have closed it. */}
        }
    }
    dispose(){
        this.disposed=true
        if(!this.pending)void this.release()
    }
}
