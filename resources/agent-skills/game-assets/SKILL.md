---
name: game-assets
description: Prepare and integrate game models, textures, sprites, animation, audio, and asset manifests.
---

# Game Assets

Inventory existing assets before generation or download. Record source, license, attribution, intended usage, dimensions, and optimization steps in an asset manifest. Do not assume an internet image or model is licensed for redistribution. Do not claim access to a paid generator or API unless credentials and a working tool exist.

Use concept references to establish consistency before production. Assets need matching scale, palette, proportions and style. For 3D: inspect pivots, orientation, unit scale, normals, material slots, bounding box, animation clips, and collision proxy. For sprites: consistent frame canvas, baseline, pivot, trim metadata, animation timing and atlas gutters. Verify transparent edges against actual backgrounds.

Separate source assets from optimized runtime files. Prefer web-friendly formats supported by the selected engine. Bound texture sizes by screen usage and target GPU memory; use atlases when appropriate, but account for filtering and mip bleeding. Keep normal/roughness/metalness textures treated as data.

Sound design needs event-based SFX, ambience, UI cues and optional music. Use gain buses, limiter/headroom, concurrency limits and distance attenuation for spatial audio. Resume the audio context after gesture. Avoid creating hundreds of overlapping sources; stop owned sounds on reset/pause/teardown. Provide mute/volume.

If generation is unavailable, create clear procedural placeholders and state that they are placeholders. Do not silently substitute low-quality assets while claiming final art. Load asynchronously with fallback geometry or informative errors, and verify every manifest path in a production build.
