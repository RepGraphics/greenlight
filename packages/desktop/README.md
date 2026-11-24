# Greenlight desktop

The Electron / Next.js desktop application used by the Greenlight fork. Both the classic player and optional V3 experimental player are available in this workspace. The separate `desktop-v3` workspace is not the installer target.

## Build from the repository root

Use Node.js 24 and Yarn Classic 1.22.22.

```sh
yarn install --frozen-lockfile
yarn desktop test
yarn desktop dev
yarn desktop build
```

The build script compiles the renderer and Electron main/preload files, checks their existence, then packages the application. Use `yarn desktop build --no-pack` to compile only, or `yarn desktop package:local` to package an existing compiled application without publishing.

Output: `packages/desktop/dist/`. See the [installer workflow](../../.github/workflows/fork-installers.yml) for the CI matrix.

## Layout

- `main/`: Electron process, authenticated Xbox APIs, IPC and session management.
- `renderer/`: dashboard, settings, classic player and V3 adapter.
- `shared/settings-defaults.json`: defaults shared by Electron and the renderer.
- `tests/unit/`: regression tests for preferences and diagnostics.
- `../player/`: shared V3 WebRTC implementation.

Use [the root README](../../README.md) for installation, feature descriptions and troubleshooting. Do not assume successful compilation proves Xbox runtime compatibility.
