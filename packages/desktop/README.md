# Greenlight desktop

The Electron / Next.js desktop application used by the Greenlight fork. Both the classic player and optional V3 experimental player are available in this workspace. The separate `desktop-v3` workspace is not the installer target.

## Build from the repository root

Use Node.js 24 and Yarn Classic 1.22.22.

```sh
yarn install --frozen-lockfile
yarn desktop test
yarn desktop build
```

The build script compiles the renderer and Electron main/preload files, checks their existence, then packages the application. Use `yarn desktop build --no-pack` to compile only, or `yarn desktop package:local` to package an existing compiled application without publishing.

Output: `packages/desktop/dist/`. See the [installer workflow](../../.github/workflows/fork-installers.yml) for the CI matrix.

## Local testing and logs

In VS Code, launch **Nextron: All** from Run and Debug. The task starts the renderer and attaches to the Electron main process and renderer. Use the task terminal for startup and Next.js output. Switch between **Nextron: Main** and **Nextron: Renderer** in the Debug Console for JavaScript output. Use **Tasks: Terminate Task** to stop the development server.

To start the same developer build from the repository root, run `yarn desktop nextron dev --renderer-port 8888 --startup-delay 30000`. The developer build uses a separate settings and session profile. Set `DEBUG` to `greenlight:electron` in your shell to include Electron startup and window logs.

Run **Greenlight: Desktop smoke test** from **Tasks: Run Task**, or use the terminal:

```sh
yarn desktop test:smoke
```

This builds and launches V2 Electron in a temporary profile, checks the sign-in screen and a read-only IPC request, then closes the app. For the separate V3 Electron build, run `yarn build:depsv3` (from Git Bash on Windows), then `yarn desktopv3 test:smoke`. The smoke tests require a desktop display, use no Xbox credentials, and cover startup before sign-in. For playback and controller behavior, sign in and test with an Xbox or Cloud Gaming session.

## Layout

- `main/`: Electron process, authenticated Xbox APIs, IPC and session management.
- `renderer/`: dashboard, settings, classic player and V3 adapter.
- `shared/settings-defaults.json`: defaults shared by Electron and the renderer.
- `tests/unit/`: regression tests for preferences and diagnostics.
- `../player/`: shared V3 WebRTC implementation.

Use [the root README](../../README.md) for installation, feature descriptions and troubleshooting. Do not assume successful compilation proves Xbox runtime compatibility.
