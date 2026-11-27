# Android client (experimental)

This experimental Android APK offers two modes. Desktop companion uses the existing authenticated desktop WebUI. Private V3 mode uses an independently hosted experimental V3 frontend and RPC backend, so it does not require Electron to run. Neither mode implements native Xbox signaling or native token storage. The app does not modify the desktop listener (127.0.0.1), IPC permissions or firewall configuration.

## Build

Use Android Studio or JDK 17, Gradle 8.11.1 and Android SDK 35. From this directory run:

    gradle :app:assembleDebug :app:lintDebug

Output: app/build/outputs/apk/debug/app-debug.apk. CI builds the same debug APK and uploads it as an Actions artifact. Debug signing is for development only; no Play Store or signed release is claimed. The companion has a separate experimental version and ID, which are not the final StreamCloud release identity.

## Private testing

Only use an HTTPS endpoint you administer, reachable through a private network/VPN with an authenticated reverse proxy preserving the desktop WebUI's Host/Origin, HTTP Basic authentication and WebSocket upgrade. The proxy must be configured by the operator, must not publicly expose the loopback WebUI, and must have a valid trusted certificate. No proxy is provisioned by this app. Never enter the WebUI token on an untrusted endpoint.

In the desktop, obtain the WebUI access token in settings. Enter the HTTPS origin (port 443, no path, query or embedded credentials) and token in the companion. The app responds only to the expected WebUI Basic challenge. The token is not intentionally persisted, but WebView's authentication session may cache credentials until disconnect. Site storage is cleared on disconnect. No JS-native bridge, arbitrary navigation, cleartext, certificate bypass, camera or microphone access is provided. External resources are blocked, so artwork or other cross-origin features may not work. The WebView is not a separate network sandbox; trust the endpoint's scripts and deployment. WebSocket Basic authentication, Xbox streaming, touch/gamepad input, backgrounding and device lifecycle still need testing on a real Android device.

End the Xbox stream using the WebUI before closing the companion. Closing the WebView does not acknowledge remote stop; desktop session cleanup remains the backend's responsibility. The companion is not a solution for exposing the desktop WebUI remotely.

## Private V3 backend (experimental)

Use an operator-managed, access-controlled HTTPS origin serving the experimental V3 static web export and same-origin /trpc RPC backend. Restrict access to a private network/VPN and enforce authorization at the gateway; this app does not provision or authenticate that gateway. Do not publicly deploy the experimental RPC backend. The web frontend must be updated to the memory-only device-code authentication implementation. Experimental Remote Play and Cloud Gaming integrations are now included in `main-v2`; use a matching frontend and backend build. See the [V3 web client guide](../desktop-v3/README.md).

Select Private V3 backend and enter its origin. No desktop access token is accepted or sent in this mode, and HTTP Basic challenges are rejected. Start Microsoft sign-in inside the web client, note its device code, then tap Open Microsoft device sign-in. The app opens the fixed official device-login URL in your system browser, without including any device code or credential in the URL. Complete authorization there, return to the app, and allow the web client to finish the exchange. No Microsoft password entry inside the WebView is needed. The backend is still trusted with tokens, which is why private deployment and gateway access control are mandatory.

Session credentials remain in the experimental web client's memory; disconnect or process death requires signing in again. Android WebRTC playback, backgrounding during sign-in, gamepad support, and remote session cleanup are unverified. End sessions explicitly before disconnecting.

## Remembering a connection

Optionally select **Remember endpoint and connection mode (not credentials)** before connecting. The app stores only the canonical HTTPS origin and the selected mode in private app preferences. Next launch pre-fills these fields but never automatically connects or signs in. Desktop tokens and Microsoft credentials are not saved by this feature. Uncheck the option or tap **Forget saved connection** on the connection screen to clear the saved preference; the latter also clears the current input fields. Android app backup remains disabled. Remembering an origin does not verify its trustworthiness or bypass TLS checks.

## Small-screen and keyboard testing

The connection form scrolls when space is limited, including landscape and when the keyboard is visible. The connected native toolbar scrolls horizontally, leaving more vertical space for playback. Endpoint and token inputs opt out of Android autofill and request no personalised keyboard learning; this is a platform hint, not a guarantee about third-party keyboards. The existing no-persistence and private-origin policies are unchanged.

Device verification checklist (not yet executed):

- Rotate the connection screen to landscape with the keyboard open; verify Connect, Remember and Forget remain reachable by scrolling.
- Submit an invalid endpoint/token and verify the validation message is brought into view and announced by accessibility services.
- Connect in both modes on a narrow display; scroll the native toolbar to reach Disconnect, Fullscreen and (V3 only) Microsoft device sign-in.
- Enter fullscreen, rotate, exit using Back and verify the same WebView remains active. Confirm that the keyboard and system bars do not cover required controls.

## Fullscreen playback

In either connected mode, tap **Fullscreen (Back to exit)** to hide the native controls and system bars without recreating the WebView. Swipe from the screen edge to temporarily reveal the system bars; use Android Back to restore the controls before disconnecting. The connected WebView requests that the screen stay awake while visible; this does not keep the device awake in the background. Disconnecting resets fullscreen. Real device, gesture navigation and rotation testing remain necessary.

## Standalone roadmap

A truly backend-independent Android client still needs native authentication/token storage, Xbox signaling, media and input integration. Private V3 mode is an intermediate architecture, not a native standalone client or a production release.
