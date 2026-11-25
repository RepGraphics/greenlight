type Rect={left:number;top:number;width:number;height:number}
// Centered video: exclude letterbox starts; clamp held contacts at edges.
export function normalizedTouchPoint(x:number,y:number,rect:Rect,videoWidth:number,videoHeight:number,fit:string,starting:boolean){
    if(![x,y,rect.left,rect.top,rect.width,rect.height,videoWidth,videoHeight].every(Number.isFinite)||Math.min(rect.width,rect.height,videoWidth,videoHeight)<=0)return null
    let width=rect.width,height=rect.height
    if(fit!=='fill'){
        const ratio=fit==='cover'?Math.max(width/videoWidth,height/videoHeight):Math.min(width/videoWidth,height/videoHeight)
        width=videoWidth*ratio;height=videoHeight*ratio
    }
    const px=(x-rect.left-(rect.width-width)/2)/width,py=(y-rect.top-(rect.height-height)/2)/height
    if(starting&&(px<0||px>1||py<0||py>1||x<rect.left||x>rect.left+rect.width||y<rect.top||y>rect.top+rect.height))return null
    return {x:Math.max(0,Math.min(1,px)),y:Math.max(0,Math.min(1,py))}
}
