---
name: game-director
description: Plan and deliver browser games from a brief; choose scope, engine, milestones, and release gates.
---

# Game Director

Start with the user's genre, platform, perspective, input devices, and reference. Infer reversible defaults and state them briefly. Ask only about choices that change the whole product. Inspect the project before picking an engine. Preserve its existing stack.

For a new project choose Canvas/Phaser for sprite-heavy 2D; Three.js for direct 3D rendering; React Three Fiber when React integration is central. Do not bring in React solely to drive a per-frame simulation. Verify current APIs against official documentation and the installed version.

Write a short design brief with: player fantasy, repeatable 30-second loop, objective, lose condition, controls, one distinctive mechanic, target devices, visual direction, performance budget, and explicit exclusions. Build a playable vertical slice before adding content. A vertical slice must start, accept input, explain the objective, resolve success/failure, and restart without reloading.

Milestones: (1) inspect and brief, (2) core loop with placeholder geometry, (3) collisions/camera/feedback, (4) cohesive assets and UI, (5) QA/performance, (6) production build and handoff. Report actual progress through report_progress. For sustained user-authorized objectives use the goal tools; record acceptance criteria, evidence, and blockers. Do not claim completion solely because time has passed.

Load phaser-2d for Phaser projects. Load gameplay-systems for simulation; threejs-graphics for 3D visuals; game-ui for HUD/input; game-assets for media; game-performance for frame issues; game-qa for tests and release. Load only what the current milestone needs. Small tasks need only the relevant section. Never rewrite a functioning game just to follow this process.

Finish with controls, how to run, implemented behavior, checks performed, evidence paths, and remaining limitations. Never describe a screenshot or test you did not inspect or execute.
