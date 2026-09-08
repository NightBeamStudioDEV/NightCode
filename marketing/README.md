# NightCode launch film

A 47-second, 1920×1080, 30 fps Remotion composition with recorded Electron UI, animated typography, benchmark charts, and an original synthesized ambient score.

## Reproduce

From the repository root, on Windows:

```powershell
npm ci
npm run build
npm ci --prefix marketing
node marketing/capture.cjs
node marketing/audio.cjs
node marketing/render.cjs
```

The render is written to `marketing/out/NightCode-launch-1080p.mp4`. Seven review frames are saved beside it. Remotion downloads its rendering browser on first use.

## Footage and claims

The capture script opens the actual Electron application with an isolated profile and a disposable project. It records the skills browser, model picker, file review, and command approval flow. Its local scripted provider performs an actual file edit and assertion command. This demonstration is labeled in the film and is not a recording of a live commercial model response. It needs no API key or provider credits.

The chart uses the three paired runs in `docs/benchmarks/heldout.json`: combined elapsed time fell from 297.725 to 242.765 seconds. All three tasks passed; two became faster and one slower. This is a small single-attempt comparison, not a general speed guarantee.

The application capture is edited for pacing. Raw takes and generated audio/video are excluded from Git; rerun the scripts to recreate them. Temporary demo folders are retained for inspection.

The soundtrack is synthesized by `audio.cjs`, with no sampled recordings. The Inter font is covered by its OFL notice in the repository's third-party notices. Remotion and its dependencies retain their own licenses; the separate marketing package does not ship inside the NightCode installer.
