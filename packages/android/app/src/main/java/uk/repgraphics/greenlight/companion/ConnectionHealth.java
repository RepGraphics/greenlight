package uk.repgraphics.greenlight.companion;

/** Native WebView status only; never claims that an Xbox session is connected. */
public final class ConnectionHealth {
    public enum State {
        IDLE, LOADING, PAGE_LOADED, DNS, NETWORK, TIMEOUT, TLS, AUTH,
        HTTP_CLIENT, HTTP_SERVER, NAVIGATION_BLOCKED, RENDERER_STOPPED, DISCONNECTED
    }
    private State state = State.IDLE;
    private ConnectionMode mode;
    public State state() { return state; }
    public void start(ConnectionMode value) { mode = value; state = State.LOADING; }
    public void pageLoaded() { if (state == State.LOADING) state = State.PAGE_LOADED; }
    public void fail(State reason) {
        switch (reason) {
            case DNS: case NETWORK: case TIMEOUT: case TLS: case AUTH:
            case HTTP_CLIENT: case HTTP_SERVER: case NAVIGATION_BLOCKED: case RENDERER_STOPPED:
                state = reason;
                break;
            default: break;
        }
    }
    public void disconnected() {
        if (state == State.LOADING || state == State.PAGE_LOADED) state = State.DISCONNECTED;
    }
    // Stable Android WebViewClient error codes; no raw URLs or error descriptions.
    public static State networkError(int code) {
        switch (code) {
            case -2: return State.DNS;
            case -8: return State.TIMEOUT;
            case -11: return State.TLS;
            case -4: case -5: return State.AUTH;
            default: return State.NETWORK;
        }
    }
    public static State httpError(int status) {
        if (status == 401 || status == 403 || status == 407) return State.AUTH;
        return status >= 500 ? State.HTTP_SERVER : State.HTTP_CLIENT;
    }
    public String guidance() {
        switch (state) {
            case DNS: return "Endpoint name could not be resolved. Check your private network or VPN.";
            case NETWORK: return "Endpoint could not be reached. Check the private backend, network and VPN.";
            case TIMEOUT: return "Connection timed out. Check the backend and private network.";
            case TLS: return "TLS certificate rejected. Use a trusted HTTPS certificate.";
            case AUTH: return "Access denied. Check private gateway access and the selected connection mode.";
            case HTTP_CLIENT: return "Backend returned a client error. Check the endpoint and matching frontend build.";
            case HTTP_SERVER: return "Backend returned a server error. Check the private backend logs.";
            case NAVIGATION_BLOCKED: return "Blocked navigation outside the selected endpoint.";
            case RENDERER_STOPPED: return "WebView stopped. Check for an existing Xbox session before reconnecting.";
            default: return "";
        }
    }
    private static String version(String value) {
        return value != null && value.matches("[0-9A-Za-z.\\-]{1,64}") ? value : "unavailable";
    }
    public String report(int api, String appVersion, String webViewVersion, boolean immersive) {
        return "Greenlight Android connection diagnostics\n"
            + "App version: " + version(appVersion) + "\n"
            + "Android API: " + api + "\n"
            + "WebView version: " + version(webViewVersion) + "\n"
            + "Mode: " + (mode == null ? "not selected" : mode.name()) + "\n"
            + "Page state: " + state.name() + "\n"
            + "Immersive: " + immersive + "\n"
            + "This reports the local WebView, not Xbox session status.\n";
    }
}
