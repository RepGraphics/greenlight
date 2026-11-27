# Experimental V3 web authentication boundary

The standalone web frontend in `packages/desktop-v3` is separate from the V3 streaming engine embedded in the stable desktop app. Before reusing it for Android, the following changes reduce exposure of authentication credentials:

- Device-code authorization is explicitly initiated and cancellable. A cancelled or superseded attempt cannot commit late credentials.
- User and Xbox tokens are retained in memory for the current application session; the legacy localStorage key is removed without reading it. Users must sign in again after reloading. This is intentional until a reviewed native credential store exists.
- Authentication RPCs bypass the React Query cache. Logout clears the application query cache. Debug views and authentication response logging have been removed.
- The web HTTP client uses POST for all tRPC procedures. The Pages adapter accepts POST queries, rejects URL input and sends no-store headers. Existing GET-based experimental clients must update together.

Windows Electron profiles use a separate native account picker. The main process runs device authorization, stores only the refresh credential under Windows OS encryption, and exchanges it for fresh Xbox tokens when a saved account is opened. The renderer receives account summaries and in-memory Xbox tokens. For stream transfer, the main process uses the refresh credential for the current account and checks that the stream bearer token belongs to that account. Switching or removing an account clears the active session credentials in the application. Removing a saved account removes its local encrypted credential.

Desktop preference backups contain settings only. Changing the local Electron profile changes which settings and accounts are available. The Windows credential store is scoped to the Windows user and separate from the web preview and other Greenlight profiles.

A public deployment still needs reviewed authorization, rate limiting, request logging, upstream host/session validation, and credential handling.

The shared player server now restricts streaming requests to production Xbox GSSV origins and validates session paths against the stream type. Redirects are rejected, including during transfer-token exchange. The new `streaming_stop_stream` mutation returns an acknowledged HTTP status, accepting 404/410 as already stopped. A standalone client must still wire this mutation into its own session ownership lifecycle; this is not a complete remote-access authorization model.
