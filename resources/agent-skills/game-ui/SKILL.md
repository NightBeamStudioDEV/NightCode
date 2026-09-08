---
name: game-ui
description: Build responsive game menus, HUDs, controls, loading states, and accessible feedback.
---

# Game Ui

Establish a small token system for spacing, typography, surfaces, accent and semantic colors. Use a consistent icon family. Design the hierarchy around the player objective: immediate status visible, secondary details discoverable, debug details hidden in production.

Keep the central playfield unobstructed. Use safe areas on mobile, min/max widths, text wrapping, and measured anchor-based placement for popovers. Test long labels and narrow/short windows. Avoid fixed-size overlays that clip. Canvas rendering resolution and CSS dimensions are different; resize both intentionally.

Menu flow: loading with meaningful progress/error recovery; title with primary Play; controls understandable before danger; pause/settings/resume; win/loss with score and restart. Settings must actually alter behavior and persist appropriately. Audio starts after user gesture and mute must affect every audio source.

Use semantic DOM buttons for overlays where possible, visible keyboard focus, Escape handling, focus return, and accessible names for icon controls. Keyboard/touch users need equivalent gameplay paths. Do not rely solely on color for health, cooldown, selected state or errors. Respect reduced-motion preferences.

Animate state changes with short transform/opacity transitions. Progress and hit feedback should be immediate; expensive ornamental animations must not delay input. Preserve the player's reading position during streaming/debug output. Use touch targets large enough for real fingers and separate competing actions.

Verify portrait/landscape, 760x600 desktop minimum when applicable, wide desktop, device pixel ratio changes, long translations, paused background tabs, touch scrolling conflicts, and focus recovery. If a control is disabled, make its unavailable state and reason clear.
