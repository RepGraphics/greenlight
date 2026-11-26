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
        System.out.println("Android origin policy tests passed");
    }
}
