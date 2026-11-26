package uk.repgraphics.greenlight.companion;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** An explicitly selected HTTPS origin, never a URL containing credentials. */
public final class OriginPolicy {
    private final String host;
    private OriginPolicy(String host) { this.host = host.toLowerCase(Locale.ROOT); }

    private static URI uri(String value) {
        try {
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.isOpaque() ||
                uri.getHost() == null || uri.getRawUserInfo() != null ||
                (uri.getPort() != -1 && uri.getPort() != 443)) return null;
            return uri;
        } catch (URISyntaxException | NullPointerException error) { return null; }
    }

    public static OriginPolicy parse(String value) {
        URI uri = uri(value);
        if (uri == null || uri.getRawQuery() != null || uri.getRawFragment() != null ||
            !(uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()))) return null;
        return new OriginPolicy(uri.getHost());
    }

    public String home() { return "https://" + host + "/"; }

    public boolean allows(String value) {
        URI uri = uri(value);
        return uri != null && host.equalsIgnoreCase(uri.getHost());
    }

    public boolean allowsChallenge(String challengeHost, String realm) {
        return host.equalsIgnoreCase(challengeHost) && "Greenlight WebUI".equals(realm);
    }
}
