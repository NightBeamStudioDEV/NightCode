---
name: phaser-2d
description: Build sprite-based browser games with Phaser scenes, physics, cameras, input and restart-safe lifecycle.
---

# Phaser 2D

Inspect the installed Phaser version, renderer, scale settings and scene structure first. Keep Boot/Preload, menu, gameplay and HUD responsibilities clear. A scene has its own systems; sharing data intentionally is better than relying on another scene's incidental objects. Verify scene start, launch, pause, sleep, shutdown and destroy behavior in [official scene documentation](https://docs.phaser.io/phaser/concepts/scenes) before choosing lifecycle calls.

Load only the assets needed for the first playable scene, then background-load additional content if appropriate. Report failed keys and URLs. Use texture atlases with consistent sprite origins and frame dimensions; animation keys must not be recreated blindly every restart.

Pick Arcade Physics for simple fast arcade bodies or Matter when shape/constraint needs justify it. Do not mix physics coordinate assumptions. Keep display dimensions, body bounds and scale in agreement. Build tile collisions deliberately; inspect edge tiles, one-way platforms and high-speed tunneling. Separate overlap triggers from solid collisions.

Own input handlers, timers, tweens and subscriptions in the scene that creates them. Clean external subscriptions on shutdown, and verify a restart does not double movement, score or sound. Use camera follow/deadzone/bounds appropriate to the genre and keep HUD in screen space.

Define resize behavior explicitly: fixed logical resolution with scaling versus expanding visible world. Convert pointer coordinates through the camera for world interaction. Check touch input, keyboard focus, pause, portrait/landscape and pixel-art filtering. Do not make UI unreadable to preserve a fixed canvas ratio.

Build one complete loop, then test repeated start/pause/restart, collider ownership, animation transitions, texture loading, and production asset paths. Load gameplay-systems, game-ui and game-qa for their respective tasks.
