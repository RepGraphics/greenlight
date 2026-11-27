# PC and Android device testing

Use the same commit for all components. The PC and Android test builds workflow can be run manually against main-v2 after it is merged, and uploads Windows x64 V2 installers, an experimental V3 Electron ZIP, V3 static web assets and a debug Android APK. No releases are published. PR artifacts are built from the PR merge revision. Download only artifacts from a trusted successful run and note the commit SHA in bug reports.

## Download and verify matching CI builds

Open [PC and Android test builds](https://github.com/RepGraphics/greenlight/actions/workflows/device-test-builds.yml), select Run workflow on main-v2, and use a successful run. The verification job checks that all four component artifacts are present, starts the same-revision local backend using the downloaded web assets, and checks the local home route, POST-only RPC boundary and no-store headers without signing in or contacting Xbox.

Download the four component artifacts and the verification artifact. Extract each component ZIP into a directory named exactly as its artifact (including the commit suffix), alongside SHA256SUMS.txt and BUILD-COMMIT.txt from the verification artifact. On a POSIX shell, run `sha256sum -c SHA256SUMS.txt` from that directory. On Windows, use `Get-FileHash -Algorithm SHA256` on individual extracted files and compare with the corresponding checksum entry. Checksums verify matching bytes, not publisher identity or code signing. The APK and development installers may be unsigned or debug-signed; the local smoke test is not a real Xbox or Android device test.

## Electron boot smoke checks

The matching Windows build workflow now runs the isolated-profile V2 and V3 Electron boot checks after compilation and before packaging. These verify the signed-out screen and local Electron IPC without requiring Xbox sign-in. They do not prove real streaming or validate the packaged installer on physical hardware. To reproduce against already-built local apps, run:

```powershell
node packages/desktop/tests/smoke.cjs v2
node packages/desktop/tests/smoke.cjs v3
```

The runner creates and removes a temporary local profile. Never run the smoke script against an existing user profile.

## Windows (PowerShell)

Install Git, Node.js 24 and Yarn Classic 1.22.22. From the repository root:

```powershell
git submodule update --init --recursive
npm install -g yarn@1.22.22
yarn install --frozen-lockfile
yarn desktop test
yarn desktop build --no-pack
yarn desktop package:local --win --x64
```

The V2 installer and ZIP are in packages/desktop/dist. Classic and the experimental V3 engine in the V2 desktop app can be tested here.

```powershell
yarn build:depsv3
yarn desktopv3 build --no-pack
yarn desktopv3 package:local --win zip --x64
```

The separate V3 Electron alpha ZIP is in packages/desktop-v3/dist. Extract it into its own directory rather than installing over V2. It retains experimental package identity. Use yarn desktop dev or yarn desktopv3 dev to run the respective development app, after building V3 dependencies for the latter.

## Web and local RPC backend

```powershell
yarn build:pages
yarn pages dev --local --ip 127.0.0.1 --port 8787
```

Visit http://127.0.0.1:8787/home/ on the PC. The static export is packages/desktop-v3/web-out; the generated packages/pages/public directory is replaced by the build. Do not store personal files there. The static export alone is not a working Xbox backend. The Pages workspace serves same-origin RPC locally. Do not use yarn deploy:pages for public testing.

## Android

Install JDK 17, Gradle 8.11.1, Android SDK platform 35 and Build Tools 35.0.0 using Android Studio or the command-line tools. Ensure JAVA_HOME, ANDROID_HOME and gradle are configured.

```powershell
cd packages/android
gradle --no-daemon :app:assembleDebug :app:lintDebug
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
cd ../..
```

Enable USB debugging and authorize the PC, or transfer the APK to the phone and install it manually. If an existing debug installation has a different signing key, Android rejects the update; uninstalling that app deletes its local data. The debug APK is not a standalone native Xbox client and does not require Play Store signing.

For the experimental Private V3 backend mode, configure a trusted private HTTPS origin on port 443 with a valid certificate, forwarding to your matching local V3 web/RPC backend through an access-controlled private network or VPN. Enforce gateway access without HTTP Basic challenges or cross-origin authentication redirects. Android refuses HTTP, non-default HTTPS ports, certificate bypass and external WebView navigation. Do not expose the RPC backend publicly or bind it to an unprotected LAN interface. Desktop companion mode instead uses the V2 WebUI, which listens on loopback and requires its own authenticated private HTTPS reverse proxy and access token. See packages/android/README.md and packages/desktop-v3/AUTH-BOUNDARY.md.

## Device checklist

- V2: sign in, discover Xbox, test Classic and experimental V3 Remote Play, controller input, audio, captures, end and reconnect.
- Separate V3 Electron and web: sign in, Remote Play and Cloud Gaming, controller presets, touch, voice chat (compatible browser), captures/replay, and session termination.
- Android: both connection modes, rotation, keyboard, native fullscreen and Back, external Microsoft sign-in for Private V3, physical controller and touch, and explicit stream termination before disconnecting.
- Record build SHA, OS/device, player engine and failure stage. Export sanitized diagnostics where available; never attach tokens or authentication screenshots. Compilation and automated checks do not establish real Xbox interoperability.
