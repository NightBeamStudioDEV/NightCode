---
name: game-qa
description: Playtest and release browser games with reproducible functional, visual, performance and build checks.
---

# Game Qa

Read the project scripts first. Use run_command for installed test/build tools; do not invent passing results or assume Playwright/browser dependencies exist. If browser automation is missing, propose/install it through the normal reviewed command path. Verify current Playwright APIs in official documentation before writing unfamiliar integration.

Create a test matrix from the actual mechanics. Minimum gameplay checks: load, start, controls, objective, collision, score, win/loss, pause/resume, restart, focus loss, resize, mute, asset failures. Include boundary cases, high-speed movement, repeated transitions and invalid saved state. Keep unit tests for simulation math/state transitions and browser tests for user-visible outcomes.

For browser automation use deterministic seeds and test hooks gated to development/test builds. Start the actual dev or preview server, wait for readiness, launch the browser, capture page errors and failed asset requests, and drive real keyboard/mouse/touch input. Stop servers and browser processes you created. Screenshots alone are not playtests.

Capture menu, active gameplay, pause and end states at representative desktop and mobile dimensions. Inspect the image, not just file existence. Check HUD clipping, overlap, tiny text, camera composition, missing textures, animation pose and contrast. Compare meaningful regions; avoid pixel-perfect checks on nondeterministic effects.

Build production output and serve it from the intended base path. Verify asset URLs, lazy chunks, MIME types, refresh behavior, and controls from that build. Check there are no development-only debug panels, leaked keys or accidental giant source assets. Export a concise report listing executed commands, observed outcomes, screenshots, performance conditions, and known issues.

Release only when user acceptance criteria have evidence. Mark blocked checks explicitly. A test timeout is a failure to investigate, not a reason to weaken assertions. Do not deploy or publish externally unless authorized.

Version-sensitive reference: [official documentation](https://playwright.dev/docs/test-webserver). Verify it against the installed version when implementing this workflow.
