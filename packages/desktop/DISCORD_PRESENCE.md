# Discord Rich Presence

This optional desktop integration uses Discord's local IPC socket only. It
requires a Discord application ID registered by the user or fork maintainer
in the [Developer Portal](https://discord.com/developers/applications).
Enter the ID under Settings → Streaming → Discord Rich Presence and enable
sharing. Discord must be running. The feature is off by default and the
opt-in and ID are excluded from portable settings backups.

Both Classic and V3 publish only the type of connected stream and elapsed
time. No game titles, Xbox user IDs, console IDs, session IDs, tokens or
join secrets are sent. Activity is cleared on stream exit, stop, or lease
expiry; missing Discord does not block streaming. The WebUI cannot invoke
the desktop presence IPC action.

Protocol reference: [Discord RPC](https://docs.discord.com/developers/topics/rpc).
Mocked protocol and lifecycle tests do not establish interoperability with
a real Discord account; verify the configured app and its access settings
on Windows, macOS and Linux before making the feature generally available.
