# StreamCloud release preparation

This is a draft migration checklist, not a release announcement. The fork continues to be developed at RepGraphics/greenlight on main-v2. Do not bump the version, publish binaries, rename installation identities, or claim Android support until the relevant implementation and verification gates below are satisfied.

## Priority and release gates

1. Classic/V3 parity: verify supported rendering, microphone, capture, diagnostics and input behavior; document unavoidable engine differences.
2. Advanced controller support: verify hotplug, remapping, neutral frames, vibration and physical device compatibility.
3. Classic reconnection: verify connection loss, bounded retries, cancellation and capture protection on real consoles.
4. Live adaptive bitrate: verify remote encoder changes without reconnecting; a bitrate cap applied on the next session is not live adaptation.
5. Capture management: verify recording, replay, export, trimming and storage limits.
6. Console power: verify supported authenticated console operations.
7. Dashboard/library: verify navigation, search, profiles and controller navigation.
8. Updater: verify signed packages, integrity, update channel, rollback and safe failure behavior.
9. Appearance: verify all themes and accessibility.
10. Discord presence: verify opt-in lifecycle and privacy.
11. HDR/rendering: investigate and document hardware, codec and display limits without claiming unverified HDR playback.
12. Android: implement, build and validate a functional APK; do not describe a desktop-dependent companion as a standalone client.
13. StreamCloud branding: review logo, application names, installer assets, translations, release notes and migration compatibility.
14. Version: decide the final semantic version after all release gates are verified; build and test that exact release commit.

## Android architecture investigation

The main desktop renderer is a static Next export and uses the Electron preload IPC bridge (renderer/lib/ipc.ts); its browser fallback connects to a same-origin desktop WebSocket /ipc endpoint. An Android WebView cannot supply Electron main-process authentication, token storage, session signaling, power controls or desktop filesystem operations. The existing WebUI is intended for localhost and must not be exposed publicly to make Android appear functional.

The V3 web target (packages/desktop-v3 and packages/pages) and the shared packages/player WebRTC client are potential reuse points. Evaluate their actual authentication and service dependencies before selecting an Android transport and native shell. Preserve the shared player rather than copying streaming protocol logic into a second unmaintained implementation.

Proposed first Android milestone: a standalone, debug-signed Android build that can authenticate through an approved system browser flow, securely store tokens in Android-backed storage, discover an owned console, start/stop Remote Play, render video/audio, forward physical controller and touch input, and recover across background/resume. Cloud Gaming, microphone, captures, power, adaptive bitrate and advanced rendering require separate acceptance checks. A native companion requiring another running desktop is a different product and would need explicit approval.

Use a supported Android SDK/Gradle toolchain with pinned dependencies. Keep signing keys and release credentials out of source control; distinguish debug APKs from signed release APKs/AABs. CI must compile and run automated tests; real ARM64 Android hardware must verify login, WebRTC, input, audio, permissions, lifecycle, network transitions and recovery. No Android package ID or distribution channel is finalized in this draft.

## Branding and identity

Proposed original logo: dark navy rounded tile with a teal cloud, play symbol and stream lines. The vector source is renderer/public/images/streamcloud.svg under packages/desktop. The draft applies the mark to the primary desktop navigation, sign-in screen and settings/about view.

Keep the repository URL, package/workspace names, Electron app ID (uk.repgraphics.greenlight), IPC bridge (window.Greenlight), existing preference schema, secure credential storage and upstream license/attribution until an explicit migration is implemented and tested. Do not silently reset existing installations. All remaining page titles, localized display strings, app menus, installer icons, release metadata, Discord display naming and Android resources need a final audit. Maintain the original Greenlight copyright and MIT license.

## Verification

Require current regression tests, CodeQL and desktop build workflows for each merge. Build and verify Android artifacts separately when implemented. Test upgrade from the current installed desktop version, confirm saved preferences and authentication remain intact, and verify the final version/release artifacts before publication.
