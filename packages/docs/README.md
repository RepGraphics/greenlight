# Documentation

This Fumadocs / Next.js static website is deployed by the dedicated Documentation Pages workflow.

Run from the repository root:

```sh
yarn install --frozen-lockfile
yarn docs dev
yarn docs build
```

The static output is `packages/docs/out/`. The project uses the `/greenlight` base path.

For deployment, repository Settings → Pages → Source must be GitHub Actions. Run the Documentation Pages workflow on main-v2. The deployment job publishes the static output and reports the Pages URL.
