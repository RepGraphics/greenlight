# Greenlight V3 web client (experimental)

This separate V3 frontend supports Xbox Remote Play and Cloud Gaming through the shared player and an experimental RPC backend. It is not the default desktop installer or a production-ready public service.

## Features

- Microsoft device-code sign-in and in-memory session credentials.
- Console discovery, cloud game browsing, entitlement filtering and session launch.
- 720p/1080p resolution preferences and requested bitrate caps.
- Physical and on-screen controllers, experimental multiple-controller support and Remote Play console-paired mode.
- Audio mute, Xbox guide, streaming statistics, video refresh requests and acknowledged session termination.

Resolution and bitrate are negotiated when connecting, not guaranteed or adjusted live. Xbox services, browser support and individual games determine actual compatibility.

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

See [authentication boundaries](AUTH-BOUNDARY.md), [Android testing](../android/README.md) and the [main user guide](../../USER-GUIDE.md). End the active session before closing the browser. Real Xbox, mobile WebRTC and device/controller compatibility remain unverified.
