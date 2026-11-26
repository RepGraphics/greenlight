package uk.repgraphics.greenlight.companion;

/** Fullscreen is local presentation state, not an Xbox session transition. */
public final class PlaybackDisplay {
    private boolean connected;
    private boolean immersive;

    public void connected() { connected = true; immersive = false; }
    public boolean enter() {
        if (!connected || immersive) return false;
        immersive = true;
        return true;
    }
    public boolean exit() {
        if (!immersive) return false;
        immersive = false;
        return true;
    }
    public boolean disconnected() {
        connected = false;
        return exit();
    }
    public boolean isImmersive() { return immersive; }
}
