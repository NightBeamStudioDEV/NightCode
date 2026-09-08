---
name: gameplay-systems
description: Implement and tune deterministic game loops, movement, cameras, combat, collisions, and progression.
---

# Gameplay Systems

Separate simulation state, render objects, input, and UI. Model lifecycle explicitly: loading, menu, playing, paused, won/lost. Each transition owns its cleanup. Restart resets entities, timers, score, input latches, camera, and pooled effects. Avoid duplicate animation loops/listeners after restart.

Use a fixed simulation timestep with an accumulator for physics and collision; clamp elapsed time after tab suspension and cap catch-up steps. Interpolate rendering when useful. Keep game speeds in world-units per second, never per frame. Seed random generation for reproducible tests. Pass input state into simulation rather than reading DOM inside entity logic.

Movement: normalize diagonal input, separate acceleration from max speed, handle ground detection and slopes explicitly. Platformers benefit from a short coyote window and jump buffering; tune against playtests, not universal constants. Use swept tests/substeps for fast projectiles. Broad-phase spatial partitioning prevents all-pairs collisions. Define collision layers and avoid self-hits.

Camera: establish a target, damping, bounds, collision response, and shake limits. Avoid UI/camera motion that hides hazards. FPS needs pointer lock with a visible click-to-start and Escape recovery. Third-person needs wall avoidance and a stable aim target. Touch requires reachable controls and appropriate sensitivity.

Combat needs readable windup, active frames, recovery, hit feedback, invulnerability rules, and distinct enemy silhouettes. Define damage/knockback ownership to prevent double hits. Spawn outside the visible danger radius where appropriate. Difficulty should change deliberately, not merely inflate health.

Test win/loss, restart repeatedly, pause/resume, focus loss, high/low framerate, simultaneous inputs, fast collisions, and empty/out-of-bounds levels. Keep debug controls behind a development flag. Tune one mechanic at a time and compare the observed result.
