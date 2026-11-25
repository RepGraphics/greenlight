# HDR, live bitrate and Discord integration notes

## HDR / advanced rendering

The debug page now reports local display and video dynamic-range media queries,
wide-gamut hints, WebGPU API availability and advertised WebRTC receiver codec MIME
types. These are capability hints, not a negotiated Xbox stream profile.

The experimental WebGPU renderer currently copies video into an `rgba8unorm`
texture and configures the canvas with the preferred format. It does not
explicitly negotiate a high-bit-depth HDR canvas or preserve PQ/HLG metadata.
Enabling a monitor's HDR mode alone is not sufficient.

Before enabling HDR playback:
- Verify the Xbox session actually offers a supported HDR codec/profile.
- Inspect decoded frame color space, transfer characteristics and bit depth.
- Preserve range and color space through the video or GPU path; compare SDR
  tone mapping and HDR output on real HDR and SDR displays.
- Verify fallback, GPU device loss, capture behavior and platform-specific
  Electron compositor support. Keep SDR default until tested.

References: [Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/),
[WebGPU](https://www.w3.org/TR/webgpu/),
[WebRTC](https://www.w3.org/TR/webrtc/).

## Live adaptive bitrate

The existing cap is negotiated through the SDP at session establishment.
A local receiver setting cannot independently set the remote encoder's bitrate.
Keep congestion recovery explicit and bounded until a supported live sender
control or renegotiation path is confirmed against actual Xbox sessions.

## Discord Rich Presence

Discord's local RPC requires a registered Discord application ID. Register a
fork-specific application and decide which activity details and artwork to
publish before shipping an opt-in integration. Default to disabled, avoid
publishing account identifiers, and clear activity on stream exit or shutdown.
Test absent/restarted Discord and local IPC reconnects on each supported OS.
Do not reuse another application's ID or implement a user-token/self-bot flow.

Reference: [Discord RPC documentation](https://discord.com/developers/docs/topics/rpc).
