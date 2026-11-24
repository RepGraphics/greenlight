export function screenshotFilename(date = new Date()) {
    return 'greenlight-' + date.toISOString().replace(/[:.]/g,'-') + '.png'
}

export function currentVideo(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>('.gl-experimental-stream #playerContainer video')
}

export function canCapture(video: HTMLVideoElement | null): video is HTMLVideoElement {
    return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0)
}

// Capture only decoded game video; never capture other windows or UI.
export async function saveStreamScreenshot(video: HTMLVideoElement | null) {
    if (!canCapture(video)) throw new Error('No decoded frame')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(video,0,0)
    const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'))
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href=url; link.download=screenshotFilename()
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export async function toggleStreamPictureInPicture(video: HTMLVideoElement | null) {
    if (document.pictureInPictureElement && document.pictureInPictureElement === video) {
        await document.exitPictureInPicture()
        return
    }
    if (!canCapture(video) || !document.pictureInPictureEnabled || typeof video.requestPictureInPicture !== 'function') throw new Error('Picture-in-picture unavailable')
    if (document.pictureInPictureElement) throw new Error('Another video is in picture-in-picture')
    await video.requestPictureInPicture()
}
