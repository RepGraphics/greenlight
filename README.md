# Greenlight

Play your Xbox games on Windows, macOS and Linux, including handheld PCs. Greenlight is an unofficial, open-source client for Xbox Remote Play and Xbox Cloud Gaming, with a redesigned interface and expanded streaming controls in this independently maintained fork.

[![Desktop installers](https://github.com/RepGraphics/greenlight/actions/workflows/fork-installers.yml/badge.svg?branch=main-v2)](https://github.com/RepGraphics/greenlight/actions/workflows/fork-installers.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[**Download**](https://github.com/RepGraphics/greenlight/releases) · [Development builds](https://github.com/RepGraphics/greenlight/actions/workflows/fork-installers.yml) · [User guide](USER-GUIDE.md) · [Report an issue](https://github.com/RepGraphics/greenlight/issues)

## Screenshots

<p align="center">
  <img src="images/main-nowindow.jpg" alt="Greenlight console dashboard" width="48%" />
  <img src="images/stream-nowindow.jpg" alt="Greenlight gameplay stream" width="48%" />
</p>

*Existing Greenlight screenshots; the redesigned interface may differ.*

## Features

- **Remote Play and Cloud Gaming** — stream from your Xbox or play eligible games in the cloud.
- **Dashboard and library** — browse consoles, cloud games, favourites, recent titles, friends and achievements.
- **Controller support** — remapping, calibration, profiles, handheld navigation and console-paired mode.
- **Streaming controls** — resolution and bitrate preferences, video filters, network graphs and opt-in automatic recovery.
- **Captures and replay** — screenshots, local clips, instant replay and a capture library on supported renderers.
- **Personalisation and tools** — appearance settings, session history, diagnostics and an integrated update downloader.
- **Experimental V3 player** — an alternative streaming engine with WebGPU, multiple local controllers and native mouse, keyboard and touch input on supported titles.

Classic remains the recommended default. V3 and advanced input/rendering features are experimental; support varies by platform, game and Xbox service. See the [feature compatibility guide](USER-GUIDE.md#streaming).

## Download

| Platform | Packages |
| --- | --- |
| Windows | EXE installer or ZIP |
| Linux / handheld PCs | AppImage or DEB |
| macOS | Universal DMG |

Download a [published release](https://github.com/RepGraphics/greenlight/releases), or get the latest successful [development build](https://github.com/RepGraphics/greenlight/actions/workflows/fork-installers.yml) for this fork. Development builds may be unsigned and require GitHub sign-in.

Sign in with your Microsoft account, enable remote features on your Xbox for Remote Play, or select an eligible Cloud Gaming title. See the [getting started guide](USER-GUIDE.md#getting-started) for setup and troubleshooting.

## Development

Requires Node.js 24 and Yarn Classic 1.22.22.

```sh
git clone --branch main-v2 https://github.com/RepGraphics/greenlight.git
cd greenlight
git submodule update --init --recursive
yarn install --frozen-lockfile
yarn desktop test
yarn desktop dev
```

[Build instructions](USER-GUIDE.md#development) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md)

## Credits and licence

Based on [Greenlight by UnknownSKL](https://github.com/unknownskl/greenlight) and its contributors. Distributed under the [MIT licence](LICENSE). This project is not affiliated with Microsoft or Xbox.
