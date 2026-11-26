# Greenlight V3 web client (experimental)

This separate V3 frontend supports Xbox Remote Play and Cloud Gaming through the shared player and an experimental RPC backend. It is not the default desktop installer or a production-ready public service.

## Features

- Microsoft device-code sign-in and in-memory session credentials.
- Console discovery, cloud game browsing, entitlement filtering and session launch.
- 720p/1080p resolution preferences and requested bitrate caps.
- Physical and on-screen controllers, keyboard controller emulation, experimental direct touchscreen input and multiple-controller support, plus Remote Play console-paired mode.
- Physical controller presets, stick deadzone, Y-axis inversion, stick swapping and optional vibration.
- Audio mute and volume, Xbox guide, toggleable streaming statistics, video refresh requests and acknowledged session termination.
- Experimental local PNG screenshots and bounded WebM clips in compatible browsers.
- Live video appearance presets, brightness, contrast, saturation and experimental sharpening.
- Experimental opt-in microphone voice chat in secure, compatible browsers.

During playback, choose either the on-screen controller or experimental direct touch for compatible Xbox titles. Keyboard controller emulation uses arrow keys for the D-pad, Enter/Backspace for A/B and the remaining bindings shown in the player. It is opt-in and is not native mouse/keyboard support. Console-paired mode disables local input.

Local captures contain decoded game video, not the desktop or web UI. WebM clips use available remote audio and are limited to 60 seconds or the shared recorder size limit. Save the capture explicitly before leaving, reconnecting or starting another capture. Nothing is uploaded. Android WebView does not currently support saving these downloads.

Before starting a session, expand Advanced physical controller options to select Standard, Southpaw, Inverted or Alternate face buttons and adjust the deadzone and axes. Settings apply to the selected session only; they are not stored across reloads. Console-paired mode bypasses local controller input. During playback, adjust volume independently of mute or toggle streaming statistics. Browser and hardware support determine vibration availability.

During playback, expand Video appearance to choose a desktop-compatible preset or adjust the individual SDR filters. Neutral restores the default appearance. These adjustments affect only the displayed video and do not change the remote stream, touch coordinates or saved captures. Sharpening requires browser SVG filter support and may increase rendering cost. Appearance is session-local, not HDR processing.

During a connected stream, choose Enable microphone (experimental) to request browser permission and negotiate Xbox voice chat. The microphone starts disabled, is independent of playback mute, and is never enabled automatically after disconnection. Cancel a pending microphone request or disable active capture at any time. Actual voice transmission depends on the Xbox service, browser permissions and hardware. Android companion builds still deny microphone access; this is not native Android microphone support.

Resolution and bitrate are negotiated when connecting, not guaranteed or adjusted live. Xbox services, browser support and individual games determine actual compatibility.

The Cloud Gaming library also offers Favourites and Recently opened collections. These contain only title identifiers in memory for the current sign-in, are cleared on sign-out or reload, and never bypass the current catalog or entitlement checks. Recently opened records opening session setup, not confirmed gameplay. Clear both collections from the library at any time.

## Development

From the repository root, use Node.js 24 and Yarn Classic 1.22.22:

```sh
yarn install --frozen-lockfile
yarn build:depsv3
yarn desktopv3 build:web
yarn desktop test
```

The static web export is in `packages/desktop-v3/web-out/`. On a POSIX shell, `yarn build:pages` also prepares the Pages workspace assets. Building does not provision a trusted deployment.

## Private testing only

Use a trusted, access-controlled HTTPS origin serving the web frontend and same-origin RPC backend over a private network or VPN. The backend handles sensitive Xbox credentials. Do not deploy it publicly; gateway authorization and operational protections remain necessary.

See [authentication boundaries](AUTH-BOUNDARY.md), [Android testing](../android/README.md) and the [main user guide](../../USER-GUIDE.md). End the active session before closing the browser. If teardown times out, retry ending the same session. The client retains ownership, waits for outstanding signaling before DELETE, and shares any pending stop request rather than issuing overlapping requests. A timeout does not confirm cancellation or remote termination. The shared session lifecycle limits each visible exit wait to two minutes, even before a session ID arrives, while retaining the underlying serialized cleanup. A new session cannot overtake unresolved provisioning or teardown. Real Xbox, mobile WebRTC and device/controller compatibility remain unverified.
