import { build } from "esbuild";
await build({
  entryPoints: ["electron/main.ts", "electron/preload.ts", "electron/sql-worker.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: "dist-electron",
  external: ["electron"],
  sourcemap: true,
});
