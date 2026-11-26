package uk.repgraphics.greenlight.companion;

/** Only a canonical origin and connection mode may be remembered. */
public final class SavedConnection {
    public final OriginPolicy origin;
    public final ConnectionMode mode;

    private SavedConnection(OriginPolicy origin, ConnectionMode mode) {
        this.origin = origin;
        this.mode = mode;
    }

    public static SavedConnection parse(String endpoint, String modeName) {
        OriginPolicy origin = OriginPolicy.parse(endpoint);
        if (origin == null || modeName == null) return null;
        try {
            return new SavedConnection(origin, ConnectionMode.valueOf(modeName));
        } catch (IllegalArgumentException error) {
            return null;
        }
    }
}
