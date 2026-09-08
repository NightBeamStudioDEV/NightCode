const { _electron: electron, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "nightcode-packaged-"));
  const app = await electron.launch({
    executablePath: path.resolve(process.argv[2] || "release/win-unpacked/NightCode Desktop.exe"),
    args: [],
    env: { ...process.env, NIGHTCODE_TEST_DATA: data },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.nightcode.invoke("snapshot").then((s) => s.engine),
          ),
        { timeout: 60000 },
      )
      .toBe("Ready");
    const session = await page.evaluate(() =>
      window.nightcode.invoke("session.create", { projectId: "" }),
    );
    if (!session.id) throw new Error("Packaged session creation failed");
    await page.screenshot({ path: "test-results/packaged-welcome.png" });
    console.log(
      "Packaged app and bundled OpenCode ready; session creation passed.",
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
