# Greenlight Fork

[![Desktop installers](https://github.com/RepGraphics/greenlight/actions/workflows/fork-installers.yml/badge.svg?branch=main-v2)](https://github.com/RepGraphics/greenlight/actions/workflows/fork-installers.yml)
[![CodeQL](https://github.com/RepGraphics/greenlight/actions/workflows/codeql-analysis.yml/badge.svg?branch=main-v2)](https://github.com/RepGraphics/greenlight/actions/workflows/codeql-analysis.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An independently maintained fork of [Greenlight](https://github.com/unknownskl/greenlight), an open-source desktop client for Xbox Remote Play and Xbox Cloud Gaming. This fork develops a redesigned interface, additional streaming controls and an optional experimental V3 player.

**Windows · Linux · macOS · Linux handhelds**

[Downloads](#downloads) · [Features](#features) · [Getting started](#getting-started) · [Troubleshooting](#troubleshooting) · [Development](#development)

> The classic player remains the default and is recommended for reliability. V3 is experimental; compatibility with every console, controller and operating system is not yet established.

## Features

### Dashboard and library

- Xbox-inspired navigation, console search, favourites and quick reconnect.
- Cloud game library, favourites and recently played titles.
- Friends, social hub and achievement browsing.
- Handheld-friendly layout and controller-based dashboard navigation.

### Streaming

| Feature | Classic | V3 experimental |
| --- | --- | --- |
| Xbox Remote Play and Cloud Gaming | Yes | Yes |
| Bitrate presets and requested display resolution | Yes | Yes |
| Standard video playback | Yes | Yes |
| WebGPU rendering | — | Experimental |
| Controller profiles, remapping and calibration | — | Yes |
| Console-paired controller mode | Yes | Yes |
| Touch gamepad and native mouse/keyboard | — | Experimental |
| Video filters and sharpening | Yes | Yes |
| Screenshots and picture-in-picture | Yes | Standard video only |
| Local clips | Yes | Standard video only |
| Live network graphs and diagnostic exports | — | Yes |
| Automatic Remote Play recovery | — | Opt-in |
| Local session history | — | Opt-in |

Some features depend on Xbox service capabilities and platform support. Requested resolution is a preference, not a guaranteed encoded resolution. Automatic recovery starts a new session, rather than seamlessly resuming the old one. Optional adaptive recovery lowers the next attempt's bitrate only when fresh metrics indicate sustained poor connection quality; saved preferences are unchanged.

## Downloads

- [Fork releases](https://github.com/RepGraphics/greenlight/releases): published releases, when available.
- [Fork desktop installers](https://github.com/RepGraphics/greenlight/actions/workflows/fork-installers.yml): development builds from successful workflow runs on `main-v2`.

Open a successful workflow run and download the artifact for your platform. GitHub may require you to sign in. Extract the artifact archive before launching the installer.

| Platform | Package |
| --- | --- |
| Windows | NSIS installer (.exe) or ZIP |
| Linux | AppImage or Debian package (.deb) |
| macOS | Universal DMG |

Maintainers can manually run the installer workflow with **draft_release** enabled to prepare an unpublished development prerelease containing all three platform artifacts, SHA-256 checksums and recent commit notes. Review the draft before publishing.

Development installers are not guaranteed to be signed or notarized. Verify the source before running them. Artifacts expire according to GitHub retention settings.

The original [Flathub package](https://flathub.org/apps/details/io.github.unknownskl.greenlight) belongs to upstream Greenlight and does not include this fork's changes.

## Getting started

1. Sign in with your Microsoft/Xbox account.
2. For Remote Play, enable remote features on your Xbox and select your console.
3. For Cloud Gaming, select an entitled game in the cloud library. Availability depends on account, subscription, game and region.
4. Configure streaming quality in **Settings → Streaming**.

### Experimental V3 player

Select V3 under **Settings → Streaming → Streaming engine**. Begin with standard video rendering, automatic bitrate and automatic H.264 profile selection. Return to Classic if you encounter stability or compatibility issues.

If your controller is paired directly to the Xbox, enable **Controller connected to Xbox** under **Settings → Input** before opening the stream. This prevents either player from registering a virtual controller or forwarding local input during Remote Play. The setting is saved between sessions.

Both engines support live brightness, contrast, saturation, sharpening, presets and display scaling. Use the video filters button in the streaming toolbar; save defaults explicitly to apply them to future sessions. Capture files remain unfiltered.

Press **F8** (default) to pin the streaming toolbar. Configure additional streaming shortcuts under Settings → Input. Use it to access network graphs, video adjustments, screenshots, clips and recovery controls.

Recording is opt-in, local WebM capture (up to five minutes, with a 128 MiB stop threshold). Screenshots and clips do not include visual filters or interface overlays. Save recordings before leaving the session; temporary clips are held in memory. Explicitly save screenshots and clips to the local Capture library under Settings for preview, rename, download or deletion. The library is limited to 512 MiB or 200 items and does not automatically delete existing captures.

### Keyboard gamepad emulation

Enable keyboard emulation in input settings. Default mappings include:

| Control | Key |
| --- | --- |
| D-pad | Arrow keys |
| A / B | A or Enter / B or Backspace |
| X / Y | X / Y |
| Nexus | N |
| LB / RB | [ / ] |
| LT / RT | - / = |
| View / Menu | V / M |

### Multiple controllers (V3 experimental)

Enable Multiple client controllers under Settings → Input before starting V3. Up to four locally connected physical controllers receive separate slots; actual multiplayer support depends on the Xbox service and game. Keyboard and touch emulation use slot zero. Console-paired controller mode takes precedence.

### Instant replay (experimental)

Enable Instant replay in the streaming toolbar to keep recent standalone WebM segments in memory. Save recent segment to download or add it to the capture library. Segments rotate every 15, 30 or 60 seconds (configurable in Settings → Streaming), with a 32 MiB cap per segment; a saved segment may be shorter and is not guaranteed to contain exactly the selected preceding duration. Replay is opt-in per session, standard-video only, mutually exclusive with manual recording, and stops on disconnect. Unsaved replay buffers are discarded. It can increase encoding load.

## Troubleshooting

- **Black screen or frozen stream:** compare Classic and V3 with the same console and quality settings. V3 has media and statistics stall detection and an optional persistent auto-reconnect setting. A recurring failure should still be reported.
- **Console controller stops responding:** enable console-connected controller mode before starting Classic or V3 and reconnect the stream.
- **WebGPU or capture problems:** use standard video rendering. Screenshot, picture-in-picture and recording support depends on the platform.
- **Handheld controls:** enable the handheld layout in settings and configure the device's controller mapping as needed.

For V3 issues, press F8, open the toolbar and select **Export diagnostics**. Current exports retain up to three preceding attempts and include connection states and stale-statistics detection. Open exported reports locally under Settings → Diagnostics viewer to inspect individual recovery attempts and network graphs. Review any attachments before sharing. Never post authentication tokens, passwords, account identifiers or unredacted network logs.

Report fork-specific bugs and requests in [Issues](https://github.com/RepGraphics/greenlight/issues). Include the exact commit/build, OS, player engine, controller connection method and reproduction steps.

## Development

Use Node.js 24 (the installer CI version) and Yarn Classic 1.22.22. The repository also contains a Node 22 version pin in `.nvmrc`; match CI when diagnosing build issues.

```sh
git clone --branch main-v2 https://github.com/RepGraphics/greenlight.git
cd greenlight
git submodule update --init --recursive
npm install --global yarn@1.22.22
yarn install --frozen-lockfile
yarn desktop test
# Node 24: test coverage report
yarn desktop test:coverage
yarn desktop dev
```

Build installers:

```sh
yarn desktop build
```

Output: `packages/desktop/dist/`. To compile without packaging, use `yarn desktop build --no-pack`.

See [desktop development](packages/desktop/README.md), [player internals](packages/player/README.md), [contribution guidance](CONTRIBUTING.md) and the [fork changelog](CHANGELOG.md).

## Privacy and security

Microsoft authentication is required for Xbox services. Desktop token storage uses Electron secure storage where supported; protection depends on the OS. The optional WebUI is intended for localhost and uses authentication. Do not expose it directly to the public internet. Session history is disabled by default; diagnostic and gameplay exports are user-initiated.

See [security reporting](SECURITY.md).

## Credits and licence

Based on [Greenlight by UnknownSKL (Jim Kroon)](https://github.com/unknownskl/greenlight) and its contributors, including [xbox-xcloud-player](https://github.com/unknownskl/xbox-xcloud-player). Fork maintained in [RepGraphics/greenlight](https://github.com/RepGraphics/greenlight). Original copyright and [MIT licence](LICENSE) retained.

Greenlight is unofficial and not affiliated with Microsoft or Xbox. All trademarks belong to their respective owners.
