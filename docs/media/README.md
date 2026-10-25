# Demo media

Captured from this project's WebGL renderer: the original 1080p media on 2026-10-24, and the native 4K master on 2026-10-25.

[Download the native 4K MP4](https://github.com/Candela683/stillwater-aquarium/releases/download/showcase-4k-2026-10-25/aquarium-demo-4k.mp4) · [Release and SHA-256](https://github.com/Candela683/stillwater-aquarium/releases/tag/showcase-4k-2026-10-25)

| File | Contents |
| --- | --- |
| aquarium-overview.png | Current aquarium canvas, 3200 × 1729 |
| aquarium-front.png | Front view from exported frame 400, 1920 × 1080 |
| aquarium-demo.mp4 | 24 seconds, 1920 × 1080, 30 fps, H.264; 720 rendered frames |
| aquarium-preview.gif | 640 × 360, 10 fps preview for the GitHub README |
| aquarium-demo-4k.mp4 (GitHub Releases) | Native 3840 × 2160, 24 seconds, 30 fps, H.264; 720 rendered frames |

The 4K master is hosted as a release asset. Each source frame was rendered directly into a 3840 × 2160 WebGL drawing buffer. The normal interactive viewport is restored after export.

The video advances the actual scene at fixed 1/30-second simulation steps. The camera moves around the front of the tank, with a local fish-startle event at frame 332 (11.07 seconds). It is an animation export, not a recording of the desktop or a real-time GPU performance measurement. There is no audio. The original paused-browser recording was replaced after frame-count verification.

Model attribution applies to these renders as well:

- Neon Tetra Automated Swimming Rig — **AeroPlankton (AeroPlankton3D)**, [source](https://sketchfab.com/3d-models/neon-tetra-automated-swimming-rig-22cddb626d9f417e9baec7894e86cb73), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified scale, animation and material.
- Rock 07 — **Jenelle van Heerden / Poly Haven**, [source](https://polyhaven.com/a/rock_07), [CC0](https://polyhaven.com/license). Simplified and recolored.

For application and dependency credits, see [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
