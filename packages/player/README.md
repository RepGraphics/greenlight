# @greenlight/player

Experimental WebRTC player library for Greenlight. The desktop application imports its React client and adapts session requests to authenticated Electron IPC. The classic player uses the separate upstream `xbox-xcloud-player` dependency.

## Client architecture

- `src/client/index.tsx`: React session lifecycle, media monitoring and input integration.
- `src/client/lib/player.ts`: peer connection and media rendering.
- `src/client/lib/channel/`: Xbox control, message, input and chat channels.
- `src/client/lib/input/`: controller, keyboard and touch handling.
- `src/client/lib/render/`: standard video, audio and experimental WebGPU.
- `src/client/lib/stats.ts`: WebRTC statistics and freshness tracking.

The desktop API already expands Teredo candidates; the player must not expand those candidates a second time. Preserve end-of-candidates handling and the configured STUN servers when modifying ICE negotiation.

Console-connected controller mode suppresses virtual input registration and local input forwarding while preserving media acknowledgements. Do not send synthetic gamepad registration in that mode.

V3 remains opt-in. Changes to transport, channel initialization or controller registration require live Xbox testing, including a comparison against Classic and sessions lasting longer than one minute.

Run desktop regression tests from the root using `yarn desktop test`. See [contribution guidance](../../CONTRIBUTING.md).
