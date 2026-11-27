package uk.repgraphics.greenlight.companion;

/** A narrowly scoped grant: no camera, mixed requests, or foreign origins. */
public final class MicrophonePolicy {
    public static final String AUDIO = "android.webkit.resource.AUDIO_CAPTURE";
    public static boolean allows(OriginPolicy selected, ConnectionMode mode, String requestingOrigin, String[] resources, boolean foreground) {
        if (!foreground || mode != ConnectionMode.PRIVATE_V3 || selected == null ||
            resources == null || resources.length != 1 || !AUDIO.equals(resources[0])) return false;
        OriginPolicy requesting = OriginPolicy.parse(requestingOrigin);
        return requesting != null && selected.home().equals(requesting.home());
    }
}
