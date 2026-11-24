// The Xbox service may choose a different encoded resolution.
export function requestedDisplay(resolution: unknown) {
    return resolution === 720 ? {widthInPixels:1280,heightInPixels:720} : {widthInPixels:1920,heightInPixels:1080}
}
