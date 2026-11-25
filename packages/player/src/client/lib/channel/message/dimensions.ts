export function streamDimensions(resolution:unknown){
    const height=resolution===720?720:1080
    const width=height===720?1280:1920
    return {
        horizontal:width,
        vertical:height,
        preferredWidth:width,
        preferredHeight:height,
        safeAreaLeft:0,
        safeAreaTop:0,
        safeAreaRight:width,
        safeAreaBottom:height,
        supportsCustomResolution:true,
    }
}
