package uk.repgraphics.greenlight.companion;

/** Never send desktop credentials in the independent V3 web mode. */
public enum ConnectionMode {
    DESKTOP_COMPANION, PRIVATE_V3;

    public static final String MICROSOFT_DEVICE_LOGIN = "https://microsoft.com/devicelogin";

    public boolean acceptsCredential(String credential) {
        return this == DESKTOP_COMPANION
            ? credential != null && credential.matches("[a-fA-F0-9]{64}")
            : credential == null || credential.isEmpty();
    }

    public boolean allowsChallenge(OriginPolicy origin, String host, String realm) {
        return this == DESKTOP_COMPANION && origin != null && origin.allowsChallenge(host, realm);
    }

    public String landingPage(OriginPolicy origin) {
        return origin.home() + (this == PRIVATE_V3 ? "home/" : "");
    }
}
