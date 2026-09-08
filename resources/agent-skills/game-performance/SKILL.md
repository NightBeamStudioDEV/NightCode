---
name: game-performance
description: Profile browser games and fix frame pacing, loading, memory growth, and input latency.
---

# Game Performance

Measure before optimizing. Identify target hardware and refresh rate; a 60 Hz target has roughly 16.7 ms total frame time, not 16.7 ms for each subsystem. Record p50/p95 frame time, draw calls, triangles, texture memory estimates, heap growth, load time and test conditions. Do not promise performance on hardware you have not measured.

Separate CPU, GPU, network, compilation and memory bottlenecks. Use browser performance traces, renderer statistics, and scoped timings; compare the same seeded scene/camera before and after. A high average FPS can hide poor frame pacing.

CPU: avoid per-frame DOM updates, allocations, full scene traversals and synchronous storage. Batch state updates, reuse vectors, pool short-lived entities, and use spatial indexes for collisions. Keep UI framework renders out of the simulation hot path.

GPU: reduce overdraw, transparency, shadow cost, material variants, expensive passes and excessive pixel ratio. Use instancing and LOD when their measured benefit outweighs overhead. Set quality presets rather than silently degrading everything. Warm important shaders during an appropriate loading stage.

Loading: parallelize independent assets with bounded concurrency; cache immutable assets, lazy-load secondary content, compress shipping files and report failures. Avoid giant base64 assets embedded in JavaScript. Inspect production bundle and network waterfall.

Memory: repeat scene load/restart at least ten times and look for monotonic growth in listeners, timers, scene nodes and GPU resources. Dispose owned buffers, textures, render targets and audio nodes. Pause simulation on hidden tabs as appropriate.

Change one bottleneck at a time. Record baseline, change, result, regression checks and remaining limit. Never use unbounded retries, polling or background loops to simulate responsiveness.
