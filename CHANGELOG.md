# Fork changelog

Changes on `main-v2` are development changes, not a new numbered release. See [commit history](https://github.com/RepGraphics/greenlight/commits/main-v2/) for individual changes and [upstream Greenlight](https://github.com/unknownskl/greenlight) for original release history.

## Unreleased

### Added

- Local diagnostics viewer for V3 exports with validated import, per-attempt summaries and network graphs.

- Configurable instant replay segment duration and an optional save-replay keyboard shortcut, with bounded finalization wait.

- Opt-in adaptive quality during existing Remote Play recovery attempts, using fresh sustained congestion evidence without restarting healthy streams.

- Opt-in multi-controller support with stable assignments for up to four client-connected controllers and slot-based vibration routing.

- Experimental opt-in instant replay with rotating standalone WebM segments, capture-library integration and bounded memory.

- Opt-in draft development releases with platform installers, recent commit notes and SHA-256 checksums after successful builds.

- Persistent local V3 capture library with preview, download, deletion and bounded storage.

- Configurable V3 streaming shortcuts for controls, fullscreen, mute, HUD, screenshots, recording and graphs.

- Per-console and per-cloud-game requested resolution overrides for both streaming engines.

- Xbox-inspired dashboard, console favourites, cloud library favourites, social hub and achievement views.
- Handheld layout, keyboard/controller navigation and controller testing.
- Opt-in V3 player with standard video and experimental WebGPU.
- Controller calibration, remapping, saved profiles, console-paired controller mode and per-console/game streaming preferences.
- Quality presets, requested 720p/1080p display negotiation, video filters and sharpening.
- V3 screenshots, picture-in-picture and bounded local WebM recording.
- Performance HUD, network graphs, diagnostic exports, local session history and settings backup/restore.
- Persistent opt-in Remote Play recovery and Windows, Linux and macOS installer CI.

### Changed / fixed

- Electron build entry point and packaging checks.
- Token storage and IPC/WebUI security hardening.
- Data-channel initialization, media monitoring, bounded session requests and renderer cleanup.
- ICE configuration aligned with Classic, removing duplicate Teredo expansion and retaining end-of-candidates handling.
- Diagnostic history retained across recovery attempts; stale stats excluded from quality summaries.
- Console-paired controller mode now suppresses the temporary controller handshake and local input packets.

### Known limitations

V3 is experimental. A recurring roughly one-minute stream interruption was reported and ICE changes improved stability in user testing; the underlying cause and cross-platform reliability are not conclusively verified. The latest console-paired controller changes still require live validation. Requested resolution is not guaranteed, WebGPU support varies, and automatic recovery restarts the session. Classic remains the default.
