---
name: threejs-graphics
description: Design cohesive 3D browser-game rendering, lighting, materials, cameras, and effects.
---

# Threejs Graphics

Inspect installed Three.js and renderer setup before changing graphics. Verify relevant API names in official version documentation. Establish reference, palette, silhouette language, scale, material roughness range, and lighting direction before adding effects.

Prioritize readable silhouettes, composition, value contrast and consistent world scale. Build a visually finished representative area before multiplying props. Distinguish navigable ground from hazards. Characters and objectives must separate from the environment at gameplay camera distance.

Use physically plausible material values with intentional roughness variation. Preserve correct color-space interpretation of color textures versus data textures. Keep tone mapping and exposure consistent. Use limited, purposeful lights; budget shadow maps and update frequency. Tune shadow bias against actual scenes, avoiding floating contacts and acne.

Load GLB/glTF with explicit progress and recoverable errors. Verify transforms, units, pivots, animation clip names, skinning, and collision proxies. Use texture compression/mesh compression only when decoder support is wired and tested. Do not equate file-size reduction with GPU-memory reduction.

Post effects serve readability: subtle bloom on selected emissive sources, restrained fog, intentional color grade, optional ambient occlusion. Avoid stacking expensive full-screen passes before measuring GPU time. Provide a low-quality preset and reduced-motion alternative for camera shake.

Use instancing for repeated static props, shared geometry/materials where appropriate, frustum/distance culling, and LOD chosen from actual screen size. Dispose owned GPU resources on scene teardown; avoid disposing shared assets still in use. Never allocate geometry/materials in the animation loop.

Inspect images at menu, gameplay, close and far cameras. Evaluate geometry, materials, lighting, composition, UI separation, effects, and consistency individually. Screenshots complement playtests; they do not prove gameplay works.

Version-sensitive reference: [official documentation](https://threejs.org/manual/en/cleanup.html). Verify it against the installed version when implementing this workflow.
