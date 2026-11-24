# Contributing

Contributions to this fork are welcome. Please use [fork issues](https://github.com/RepGraphics/greenlight/issues) and [pull requests](https://github.com/RepGraphics/greenlight/pulls) against `main-v2`. Upstream Greenlight is a separate project.

1. Describe the problem and proposed change.
2. Branch from current `main-v2`.
3. Install dependencies with Yarn Classic and the CI Node version.
4. Keep changes focused, add regression tests, and update documentation and translations where applicable.
5. Run `yarn desktop test` and `yarn desktop build --no-pack` before submitting.
6. For streaming changes, test Classic and V3 on real hardware where possible. Include console-connected and PC-connected controllers and sustained sessions beyond one minute. Clearly state tests you could not perform.

Do not commit credentials, authentication dumps, private diagnostic data or generated installers. Keep the MIT licence and upstream attribution intact. Report security issues privately as described in [SECURITY.md](SECURITY.md).

Documentation-only changes do not need to trigger a release or installer build.
