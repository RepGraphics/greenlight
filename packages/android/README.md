# Android companion (experimental)

This is a native Android APK shell around the **existing authenticated desktop WebUI**, not an independent Xbox client. It does not implement Microsoft authentication, Xbox session signaling or a local replacement for Electron's IPC backend. The desktop must be running, signed in and serving its authenticated WebUI. The app does not modify the desktop listener (127.0.0.1), IPC permissions or firewall configuration.

## Build

Use Android Studio or JDK 17, Gradle 8.11.1 and Android SDK 35. From this directory run:

    gradle :app:assembleDebug :app:lintDebug

Output: app/build/outputs/apk/debug/app-debug.apk. CI builds the same debug APK and uploads it as an Actions artifact. Debug signing is for development only; no Play Store or signed release is claimed. The companion has a separate experimental version and ID, which are not the final StreamCloud release identity.

## Private testing

Only use an HTTPS endpoint you administer, reachable through a private network/VPN with an authenticated reverse proxy preserving the desktop WebUI's Host/Origin, HTTP Basic authentication and WebSocket upgrade. The proxy must be configured by the operator, must not publicly expose the loopback WebUI, and must have a valid trusted certificate. No proxy is provisioned by this app. Never enter the WebUI token on an untrusted endpoint.

In the desktop, obtain the WebUI access token in settings. Enter the HTTPS origin (port 443, no path, query or embedded credentials) and token in the companion. The app responds only to the expected WebUI Basic challenge. The token is not intentionally persisted, but WebView's authentication session may cache credentials until disconnect. Site storage is cleared on disconnect. No JS-native bridge, arbitrary navigation, cleartext, certificate bypass, camera or microphone access is provided. External resources are blocked, so artwork or other cross-origin features may not work. The WebView is not a separate network sandbox; trust the endpoint's scripts and deployment. WebSocket Basic authentication, Xbox streaming, touch/gamepad input, backgrounding and device lifecycle still need testing on a real Android device.

End the Xbox stream using the WebUI before closing the companion. Closing the WebView does not acknowledge remote stop; desktop session cleanup remains the backend's responsibility. The companion is not a solution for exposing the desktop WebUI remotely.

## Standalone roadmap

Move the web player onto a reviewed Android-compatible signaling/authentication backend, use system-browser/device-code authorization, Android-backed secure token storage, handle lifecycle and acknowledged remote cleanup, and validate WebRTC decoding and input on real devices. The experimental desktop-v3 web frontend is not yet a substitute for this: it currently persists user tokens in browser storage and needs an authentication/security review.
