# Experimental V3 web authentication boundary

The standalone web frontend in `packages/desktop-v3` is separate from the V3 streaming engine embedded in the stable desktop app. Before reusing it for Android, the following changes reduce exposure of authentication credentials:

- Device-code authorization is explicitly initiated and cancellable. A cancelled or superseded attempt cannot commit late credentials.
- User and Xbox tokens are retained in memory for the current application session; the legacy localStorage key is removed without reading it. Users must sign in again after reloading. This is intentional until a reviewed native credential store exists.
- Authentication RPCs bypass the React Query cache. Logout clears the application query cache. Debug views and authentication response logging have been removed.
- The web HTTP client uses POST for all tRPC procedures; the Pages adapter accepts POST queries, rejects URL input and sends no-store headers. Existing GET-based experimental clients must update together. Electron IPC is unchanged.

These changes do not make a public worker a trusted credential backend. A deployment must still secure authorization, rate limits, request logging, upstream host/session path validation, token storage and lifecycle. Do not deploy this experimental backend publicly until those boundaries are reviewed. A standalone Android client and native secure storage are still outstanding.

The shared player server now restricts streaming requests to production Xbox GSSV origins and validates session paths against the stream type. Redirects are rejected, including during transfer-token exchange. The new `streaming_stop_stream` mutation returns an acknowledged HTTP status, accepting 404/410 as already stopped. A standalone client must still wire this mutation into its own session ownership lifecycle; this is not a complete remote-access authorization model.

The web worker accepts JSON POST RPC requests with at most 16 named procedures and a 2 MiB request-body limit enforced while reading the stream. Encoded request bodies, invalid procedure paths, opaque browser origins and cross-origin Fetch Metadata are rejected before dispatch. Clients without Fetch Metadata remain supported for private testing; these checks are defense in depth, not gateway authentication or authorization. Keep the backend private and access-controlled; deployment still requires rate limits, request deadlines, safe logs and trusted reverse-proxy configuration.
