package uk.repgraphics.greenlight.companion;

public final class OriginPolicyTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        OriginPolicy origin = OriginPolicy.parse("https://PRIVATE.example:443/");
        check(origin != null && origin.home().equals("https://private.example/"), "normalize HTTPS origin");
        check(origin.allows("https://private.example/home?mode=1#stream"), "same-origin navigation");
        check(origin.allows("https://PRIVATE.example:443/trpc"), "equivalent default port");
        for (String value : new String[]{"http://private.example/", "https://private.example:444/",
            "https://private.example.evil/", "https://private.example@evil/", "https://evil@private.example/",
            "file:///data/local/tmp/test", "javascript:alert(1)", "intent://private.example",
            "content://private.example/", "https://private.example\\@evil/"}) {
            check(!origin.allows(value), "blocked navigation: " + value);
        }
        for (String value : new String[]{"https://private.example/?token=x", "https://private.example/#secret",
            "https://private.example/home", "https://private.example:8443/", "https://user:password@private.example/",
            "https:///private.example", "not a URL", ""}) {
            check(OriginPolicy.parse(value) == null, "reject endpoint: " + value);
        }
        check(origin.allowsChallenge("private.example", "Greenlight WebUI"), "expected challenge");
        check(!origin.allowsChallenge("evil.example", "Greenlight WebUI"), "foreign host");
        check(!origin.allowsChallenge("private.example", "Other realm"), "foreign realm");
        check(!origin.allowsChallenge(null, null), "missing challenge");
        String token = "a".repeat(64);
        check(ConnectionMode.DESKTOP_COMPANION.acceptsCredential(token), "companion token");
        check(!ConnectionMode.DESKTOP_COMPANION.acceptsCredential(""), "companion requires token");
        check(!ConnectionMode.DESKTOP_COMPANION.acceptsCredential("g".repeat(64)), "invalid token");
        check(ConnectionMode.PRIVATE_V3.acceptsCredential(""), "V3 uses device authorization");
        check(!ConnectionMode.PRIVATE_V3.acceptsCredential(token), "V3 never accepts desktop credential");
        check(ConnectionMode.DESKTOP_COMPANION.allowsChallenge(origin, "private.example", "Greenlight WebUI"), "companion challenge");
        check(!ConnectionMode.PRIVATE_V3.allowsChallenge(origin, "private.example", "Greenlight WebUI"), "V3 rejects desktop challenge");
        check(!ConnectionMode.DESKTOP_COMPANION.allowsChallenge(origin, "evil.example", "Greenlight WebUI"), "foreign challenge");
        check(ConnectionMode.DESKTOP_COMPANION.landingPage(origin).equals("https://private.example/"), "companion landing");
        check(ConnectionMode.PRIVATE_V3.landingPage(origin).equals("https://private.example/home/"), "V3 landing");
        check(ConnectionMode.MICROSOFT_DEVICE_LOGIN.equals("https://microsoft.com/devicelogin"), "fixed Microsoft browser destination");
        SavedConnection saved = SavedConnection.parse("https://PRIVATE.example:443/", "PRIVATE_V3");
        check(saved != null && saved.origin.home().equals("https://private.example/"), "saved origin normalized");
        check(saved.mode == ConnectionMode.PRIVATE_V3, "saved V3 mode");
        saved = SavedConnection.parse("https://desktop.example/", "DESKTOP_COMPANION");
        check(saved != null && saved.mode == ConnectionMode.DESKTOP_COMPANION, "saved companion mode");
        for (String value : new String[]{"https://private.example/?token=x", "https://user:secret@private.example/",
            "http://private.example/", "https://private.example/path", "", null}) {
            check(SavedConnection.parse(value, "PRIVATE_V3") == null, "reject invalid saved origin");
        }
        for (String value : new String[]{"", "unknown", "private_v3", null}) {
            check(SavedConnection.parse("https://private.example/", value) == null, "reject invalid saved mode");
        }
        PlaybackDisplay display = new PlaybackDisplay();
        check(!display.enter() && !display.exit(), "disconnected cannot enter fullscreen");
        display.connected();
        check(display.enter() && display.isImmersive(), "connected fullscreen");
        check(!display.enter(), "duplicate enter ignored");
        check(display.exit() && !display.isImmersive(), "Back exits fullscreen without disconnect");
        check(display.enter(), "can re-enter after Back");
        check(display.disconnected() && !display.isImmersive(), "disconnect resets fullscreen");
        check(!display.enter(), "cannot enter after disconnect");
        display.connected();
        check(!display.isImmersive() && display.enter(), "new connection starts windowed");
        System.out.println("Android origin, connection mode and playback display tests passed");
    }
}
