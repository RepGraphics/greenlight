// Compatibility adapter for xbox-xcloud-player 0.2.11. Install after bind,
// before SDP negotiation, so the handshake cannot register a remote pad.
// Keep the original control authorization and input metadata/frame ACK loop.
export function configureClassicConsoleController(player: {
    _inputDriver: {start:()=>void;run:()=>void};
    _keyboardDriver: {start:()=>void};
    getChannelProcessor:(name:string)=>any;
}) {
    const control=player.getChannelProcessor('control')
    const input=player.getChannelProcessor('input')
    if(!control||!input||!player._inputDriver||!player._keyboardDriver)throw Error('Classic controller adapter unavailable')
    const ignore=()=>{}
    player._inputDriver.start=ignore
    player._inputDriver.run=ignore
    player._keyboardDriver.start=ignore
    control.sendGamepadAdded=ignore
    control.sendGamepadRemoved=ignore
    input.queueGamepadState=ignore
    input.pressButton=ignore
    input.onPointerMove=ignore
    input.onPointerClick=ignore
    input.onPointerScroll=ignore
    input.onKeyDown=ignore
    input.onKeyUp=ignore
}
