# Greenlight V3 web client (experimental)

This separate V3 frontend supports Xbox Remote Play and Cloud Gaming through the shared player and an experimental RPC backend. It is not the default desktop installer or a production-ready public service.

## Features

- Microsoft device-code sign-in. The Windows Electron preview can save and switch between Xbox accounts.
- Console discovery, cloud game artwork and details, entitlement filtering and session launch.
- Xbox friends and presence, controller dashboard navigation and local streaming defaults.
- 720p/1080p resolution preferences and requested bitrate caps.
- Physical and on-screen controllers, keyboard controller emulation, experimental direct touchscreen input and multiple-controller support, plus Remote Play console-paired mode.
- Physical controller presets, stick deadzone, Y-axis inversion, stick swapping and optional vibration.
- Audio mute and volume, Xbox guide, toggleable streaming statistics, video refresh requests and acknowledged session termination.
- Experimental local PNG screenshots, bounded WebM clips and non-destructive clip trimming in compatible browsers.
- Live video appearance presets, brightness, contrast, saturation and experimental sharpening.
- Experimental opt-in microphone voice chat in secure, compatible browsers.
- Browser-native picture-in-picture playback where supported.

During playback, choose either the on-screen controller or experimental direct touch for compatible Xbox titles. Keyboard controller emulation uses arrow keys for the D-pad, Enter/Backspace for A/B and the remaining bindings shown in the player. It is opt-in and is not native mouse/keyboard support. Console-paired mode disables local input.

Local captures contain decoded game video, not the desktop or web UI. WebM clips use available remote audio and are limited to the selected 1, 3 or 5 minute duration or the shared 128 MiB recorder size limit. Choose 1.5, 3 or 6 Mbps recording video bitrate; higher quality may hit the size limit earlier. Preview screenshots and clips locally before saving, or discard the current capture. Preview media URLs are released when hidden or removed. Save the capture explicitly before leaving, reconnecting or starting another capture. Nothing is uploaded. Android WebView does not currently support saving these downloads.

Before starting a session, expand Advanced physical controller options to select Standard, Southpaw, Inverted or Alternate face buttons and adjust the deadzone and axes. Changes in stream setup apply to the selected session; use Settings to save reusable defaults. Console-paired mode bypasses local controller input. During playback, adjust volume independently of mute or toggle streaming statistics. Browser and hardware support determine vibration availability. Expand Custom button mappings to assign any supported Xbox button to a physical button index (0–63), or listen for a press on a selected connected controller. Listening requires focus and ends after ten seconds; held or simultaneous presses require release before capture. Confirm with Apply mapping. Mappings apply to all local physical controllers for the session; defaults saved in Settings can be reused.

During playback, expand Video appearance to choose a desktop-compatible preset or adjust the individual SDR filters. Neutral restores the default appearance. These adjustments affect only the displayed video and do not change the remote stream, touch coordinates or saved captures. Sharpening requires browser SVG filter support and may increase rendering cost. Appearance is session-local, not HDR processing.

During a connected stream, choose Enable microphone (experimental) to request browser permission and negotiate Xbox voice chat. The microphone starts disabled, is independent of playback mute, and is never enabled automatically after disconnection. Cancel a pending microphone request or disable active capture at any time. Actual voice transmission depends on the Xbox service, browser permissions and hardware. Compatible Android Private V3 companion builds also require explicit native consent and Android microphone permission. Actual Xbox voice chat and background media behavior still require device testing.

During a connected session, Picture-in-picture opens the decoded game video in a floating browser window where supported. It never replaces an unrelated video's picture-in-picture window. Ending the session closes a window opened by this control; the floating window is video-only and does not contain the touch controller or capture controls. Browser support, permissions and mobile compatibility vary. Android companion support is not guaranteed.

Resolution and bitrate are negotiated when connecting, not guaranteed or adjusted live. Xbox services, browser support and individual games determine actual compatibility.

The Cloud Gaming library offers Favourites and Recently opened collections. These contain only title identifiers in memory for the current sign-in, are cleared on sign-out or reload, and never bypass the current catalog or entitlement checks. Recently opened records opening session setup, not confirmed gameplay. Clear both collections from either collection view.

Settings saves streaming quality by mode, preferred game language, video filters, audio, controller mappings, capture defaults, and library layout on this device. Export or import these preferences from Backup. The backup contains only settings. Changes made in stream setup apply to that session. Recording and replay still start only when you enable them during playback.

Use Save stream defaults in setup to reuse the selected resolution and bitrate for that mode. For Remote Play, it also saves the console-paired controller choice. After a connection failure, Back to stream setup waits for Xbox to acknowledge termination and retains your choices. Startup failures can be exported to diagnostics before any video metrics arrive.

Open the Windows preview with the same local app profile to keep settings and saved accounts between launches. The first launch with native settings imports any preferences already saved in that profile. On startup, choose a saved Xbox account or add one through Microsoft sign-in. Use the account control in the sidebar to return to the picker. Remove a profile from the picker to delete its saved sign-in on this device. The web preview signs in again after a reload.

Before connecting, open Controller test and stick drift calibration to inspect the four axes of a standard-mapped physical controller. Measure drift with both sticks untouched for three seconds, then explicitly apply the suggested deadzone. A lost controller, interrupted sampling, unfocused tab or large stick movement invalidates the measurement. The recommendation applies to all local controllers for this session only.

Instant replay is opt-in during a connected session. Choose 15, 30 or 60 second rolling segments, then enable the replay buffer. Save replay and stop finalizes the current or recent completed segment using the existing bounded desktop recorder; it is not an exact continuous history. Save the resulting capture explicitly, preview it, or discard it. Only one capture mode runs at a time. Disabling replay or ending playback releases the buffered media. Nothing is uploaded, and microphone audio is not included.

During a connected stream, select Fullscreen to expand the shared playback surface, including its on-screen controller and performance HUD. The video keeps its existing aspect ratio and direct-touch coordinate handling. Use Exit fullscreen or the browser's exit gesture to return to the rest of the controls. Fullscreen opened by this control is released when the stream ends or disconnects. Browser support varies; the Android companion retains its separate native fullscreen control. This does not renegotiate the video stream or implement native Android fullscreen APIs in the web client.

Connection history and diagnostics retains at most 300 samples or five minutes of measurements for the current stream. Expand the panel during playback or after a connection failure for latency, jitter, FPS and bitrate graphs, with stale data shown as gaps. Export the desktop-compatible JSON report explicitly; it excludes credentials, addresses and game/account identifiers. The report is local and is lost when leaving the session. Quality estimates use latency and jitter rather than guaranteeing gameplay performance.

During a connected stream, select Keep screen awake in the playback toolbar to request a screen wake lock on compatible secure browsers. The opt-in lasts only for that connected session. Hiding the tab or disconnecting releases the lock; returning to a visible tab requests it again while enabled. Battery-saving or browser policies can revoke or deny it; use Retry wake lock or Allow screen sleep. The Android companion already requests native screen-awake behavior while connected. This does not keep the device awake in the background.

Connection diagnostics can suggest a lower requested bitrate after sustained recent latency or jitter. Choose End and use suggested cap to stop the stream and return to the current title's setup with that cap, only after confirmed teardown. You can also end and return to setup without changing quality, including after a failed connection. Save captures first. Starting another session is always explicit, may rejoin a cloud queue, and does not provide live bitrate adaptation. A failed stop retains ownership and requires a retry; the suggested cap is not applied when teardown fails.

In a compatible browser, open a WebM recording or replay preview, choose the start and end in seconds, and select **Prepare trimmed copy**. The browser re-encodes the selection at normal playback speed. Output timing can vary slightly with browser seeking and recording. Save the original or the trimmed copy separately. Cancel the trim or hide the preview to stop processing. Both copies stay in memory until discarded, replaced by a new capture, or released when the stream ends.

With a standard-mapped controller and the browser tab focused, use the D-pad or left stick to move focus and A to activate a link or button. Use left and right to change a focused dropdown, and B to leave a form field or return from My Consoles to the Dashboard. Some browsers detect a controller only after a physical button press. After opening or refocusing a page, release any held controls before pressing again. Use the keyboard, mouse or touch to configure and start a session after opening it.

Settings includes a Compatibility category with local API and H.264 receiver capability checks and a shareable credential-free report. Where the browser supports file sharing, Share capture and Share trimmed copy use the native chooser; no application upload service is used. Android WebView support varies.

Use Remember setup for this sign-in to override the device defaults independently for Remote Play and Cloud Gaming, including controller mappings, touch, volume, stats and appearance. Restore device defaults clears that mode’s override. Sign-out, account switches and reload discard both overrides. Mute remains a separate playback/device preference and microphone permission is never remembered. Hiding the page disables requested voice chat without automatically reenabling it.

Completed captures survive a connection interruption or ending a stream and returning to setup, in memory for the current game page. Active recordings are stopped for finalization, unsaved rolling replay is discarded, and explicitly requested replay saves may finish. Local trimming, sharing and saving remain available without a connection. A new capture requires discarding the previous one. Ending a stream with a capture returns to setup, where leaving requires explicit discard confirmation. Browser fullscreen includes expandable essential playback controls and keeps the touch overlay aligned with the video rather than the statistics HUD. No capture persistence beyond the current page or device testing is implied.

## Development

From the repository root, use Node.js 24 and Yarn Classic 1.22.22:

```sh
yarn install --frozen-lockfile
yarn build:depsv3
yarn desktopv3 build:web
yarn desktop test
# Optional desktop boot check after building dependencies:
yarn desktopv3 test:smoke
```

The static web export is in `packages/desktop-v3/web-out/`. On Windows or POSIX shells, `yarn build:pages` also prepares the Pages workspace assets. Building does not provision a trusted deployment.

## Private testing only

Use a trusted, access-controlled HTTPS origin serving the web frontend and same-origin RPC backend over a private network or VPN. The backend handles sensitive Xbox credentials. Do not deploy it publicly; gateway authorization and operational protections remain necessary.

See [authentication boundaries](AUTH-BOUNDARY.md), [Android testing](../android/README.md) and the [main user guide](../../USER-GUIDE.md). End the active session before closing the browser. If teardown times out, retry ending the same session. The client retains ownership, waits for outstanding signaling before DELETE, and shares any pending stop request rather than issuing overlapping requests. A timeout does not confirm cancellation or remote termination. The shared session lifecycle limits each visible exit wait to two minutes, even before a session ID arrives, while retaining the underlying serialized cleanup. A new session cannot overtake unresolved provisioning or teardown. Real Xbox, mobile WebRTC and device/controller compatibility remain unverified.
