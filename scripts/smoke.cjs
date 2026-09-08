const { _electron: electron } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const os = require("os");
(async () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "nightcode-smoke-"));
  const app = await electron.launch({
    args: ["."],
    env: { ...process.env, NIGHTCODE_TEST_DATA: testDir },
  });
  try {
    const page = await app.firstWindow();
    page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
    await page.waitForSelector("h1");
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.screenshot({ path: "test-results/welcome.png" });
    await page.waitForFunction(
      async () => {
        const s = await window.nightcode.invoke("snapshot");
        return s.engine === "Ready";
      },
      null,
      { timeout: 60000 },
    );
    console.log(
      "SNAPSHOT",
      JSON.stringify(
        await page.evaluate(() => window.nightcode.invoke("snapshot")),
      ),
    );
    console.log(
      "MCP check via session",
      JSON.stringify(
        await page.evaluate(() =>
          window.nightcode.invoke("session.create", { projectId: "" }),
        ),
      ),
    );
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.screenshot({ path: "test-results/settings.png" });
    console.log("SUCCESS");
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
