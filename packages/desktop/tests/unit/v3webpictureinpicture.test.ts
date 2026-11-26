import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebPictureInPicture} from '../../../desktop-v3/renderer/utils/webpictureinpicture'

function fixture(){
    let current:Element|null=null
    let enters=0,exits=0
    const doc={pictureInPictureEnabled:true,get pictureInPictureElement(){return current},async exitPictureInPicture(){exits++;current=null}}
    const video={readyState:2,videoWidth:1920,videoHeight:1080,disablePictureInPicture:false,async requestPictureInPicture(){enters++;current=video as unknown as Element;return {} as PictureInPictureWindow}}
    const surface=video as unknown as HTMLVideoElement
    const pip=new WebPictureInPicture(doc)
    return {pip,doc,video,surface,setCurrent:(value:Element|null)=>{current=value},counts:()=>({enters,exits})}
}
test('picture-in-picture requires decoded video and supported browser APIs',()=>{
    const f=fixture()
    assert.equal(f.pip.state(null).available,false)
    assert.equal(f.pip.state(f.surface).available,true)
    f.video.readyState=1
    assert.equal(f.pip.state(f.surface).available,false)
    f.video.readyState=2;f.doc.pictureInPictureEnabled=false
    assert.equal(f.pip.state(f.surface).available,false)
    f.doc.pictureInPictureEnabled=true;f.video.disablePictureInPicture=true
    assert.equal(f.pip.state(f.surface).available,false)
    f.pip.dispose()
})
test('user can enter and exit picture-in-picture on the current stream',async()=>{
    const f=fixture()
    assert.equal(await f.pip.toggle(f.surface),true)
    assert.equal(f.pip.state(f.surface).active,true)
    assert.equal(await f.pip.toggle(f.surface),true)
    assert.equal(f.pip.state(f.surface).active,false)
    assert.deepEqual(f.counts(),{enters:1,exits:1})
    f.pip.dispose()
})
test('never take over another video or close a foreign picture-in-picture window on dispose',async()=>{
    const f=fixture(),other={} as Element
    f.setCurrent(other)
    assert.equal(f.pip.state(f.surface).available,false)
    await assert.rejects(f.pip.toggle(f.surface),/unavailable/)
    f.setCurrent(null);await f.pip.toggle(f.surface)
    f.setCurrent(other);f.pip.dispose()
    assert.equal(f.doc.pictureInPictureElement,other)
    assert.deepEqual(f.counts(),{enters:1,exits:0})
})
test('dispose closes only the picture-in-picture opened by this controller',async()=>{
    const f=fixture()
    f.setCurrent(f.surface)
    f.pip.dispose()
    assert.equal(f.doc.pictureInPictureElement,f.surface)
    const next=fixture()
    await next.pip.toggle(next.surface);next.pip.dispose()
    assert.equal(next.doc.pictureInPictureElement,null)
    assert.deepEqual(next.counts(),{enters:1,exits:1})
})
test('duplicate requests are ignored and a late successful entry is cleaned up after disposal',async()=>{
    const f=fixture()
    let resolve!:()=>void
    f.video.requestPictureInPicture=()=>new Promise<PictureInPictureWindow>(done=>{resolve=()=>{f.setCurrent(f.surface);done({} as PictureInPictureWindow)}})
    const pending=f.pip.toggle(f.surface)
    assert.equal(f.pip.state(f.surface).busy,true)
    assert.equal(await f.pip.toggle(f.surface),false)
    f.pip.dispose();resolve()
    assert.equal(await pending,false)
    assert.equal(f.doc.pictureInPictureElement,null)
    assert.equal(f.counts().exits,1)
})
test('rejected native requests clear busy state and allow an explicit retry',async()=>{
    const f=fixture()
    f.video.requestPictureInPicture=async()=>{throw Error('denied')}
    await assert.rejects(f.pip.toggle(f.surface),/denied/)
    assert.equal(f.pip.state(f.surface).busy,false)
    assert.equal(f.pip.state(f.surface).available,true)
    f.pip.dispose()
})
