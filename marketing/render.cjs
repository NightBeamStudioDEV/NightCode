const { bundle } = require("@remotion/bundler");
const {
  selectComposition,
  renderMedia,
  renderStill,
} = require("@remotion/renderer");
const path = require("node:path");
(async () => {
  const serveUrl = await bundle({
    entryPoint: path.join(__dirname, "index.jsx"),
    publicDir: path.join(__dirname, "public"),
  });
  const composition = await selectComposition({
    serveUrl,
    id: "NightCodeLaunch",
  });
  for (const frame of [90, 260, 470, 670, 825, 1110, 1320])
    await renderStill({
      serveUrl,
      composition,
      frame,
      output: path.join(__dirname, `out/frame-${frame}.png`),
    });
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: 18,
    concurrency: 4,
    outputLocation: path.join(__dirname, "out/NightCode-launch-1080p.mp4"),
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== last) {
        console.log(`Render ${p * 10}%`);
        last = p;
      }
    },
  });
  console.log("Rendered 47-second 1920×1080 film.");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
