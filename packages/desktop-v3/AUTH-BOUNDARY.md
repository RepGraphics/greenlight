# Experimental V3 web authentication boundary

The standalone web frontend in `packages/desktop-v3` is separate from the V3 streaming engine embedded in the stable desktop app. Before reusing it for Android, the following changes reduce exposure of authentication credentials:

- Device-code authorization is explicitly initiated and cancellable. A cancelled or superseded attempt cannot commit late credentials.
- User and Xbox tokens are retained in memory for the current application session; the legacy localStorage key is removed without reading it. Users must sign in again after reloading. This is intentional until a reviewed native credential store exists.
- Authentication RPCs bypass the React Query cache. Logout clears the application query cache. Debug views and authentication response logging have been removed.
- The web HTTP client uses POST for all tRPC procedures; the Pages adapter accepts POST queries, rejects URL input and sends no-store headers. Existing GET-based experimental clients must update together. Electron IPC is unchanged.

These changes do not make a public worker a trusted credential backend. A deployment must still secure authorization, rate limits, request logging, upstream host/session path validation, token storage and lifecycle. Do not deploy this experimental backend publicly until those boundaries are reviewed. A standalone Android client and native secure storage are still outstanding.
