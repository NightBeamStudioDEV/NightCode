const {
  _electron: electron,
  expect,
} = require("../node_modules/@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const output = path.join(__dirname, "public");
  await fs.mkdir(output, { recursive: true });
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-film-"));
  const demoRoot = await fs.mkdtemp(
    path.join(path.parse(__dirname).root, "NightCode-demo-"),
  );
  const project = path.join(demoRoot, "Orbit");
  await fs.mkdir(project);
  await fs.writeFile(
    path.join(project, "game.js"),
    "export const playerSpeed = 4;\n",
  );
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const b = JSON.parse(raw || "{}");
    if (!b.stream) {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            {
              message: { role: "assistant", content: "Tune player movement" },
              finish_reason: "stop",
            },
          ],
        }),
      );
      return;
    }
    const count = (b.messages || []).filter((m) => m.role === "tool").length;
    const calls = [
      ["read_file", { path: "game.js" }],
      [
        "propose_edit",
        { path: "game.js", content: "export const playerSpeed = 6;\n" },
      ],
      [
        "run_command",
        {
          command:
            "node --input-type=module -e \"import {readFileSync} from 'node:fs'; import assert from 'node:assert/strict'; assert.match(readFileSync('game.js','utf8'), /playerSpeed = 6/); console.log('Player speed check passed');\"",
        },
      ],
    ];
    await pause(1400);
    const call = calls[count];
    const delta = call
      ? {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: "demo-" + count,
              type: "function",
              function: {
                name: "nightcode_" + call[0],
                arguments: JSON.stringify(call[1]),
              },
            },
          ],
        }
      : {
          role: "assistant",
          content:
            "Player speed is now 6. The command check passed. Playtest movement in the browser before tuning further.",
        };
    res.setHeader("Content-Type", "text/event-stream");
    res.end(
      "data: " +
        JSON.stringify({
          id: "demo",
          object: "chat.completion.chunk",
          choices: [
            { index: 0, delta, finish_reason: call ? "tool_calls" : "stop" },
          ],
        }) +
        "\n\ndata: [DONE]\n\n",
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const app = await electron.launch({
    args: [path.join(__dirname, "..")],
    env: { ...process.env, NIGHTCODE_TEST_DATA: data },
    recordVideo: {
      dir: path.join(__dirname, "out/raw"),
      size: { width: 1440, height: 900 },
    },
  });
  const page = await app.firstWindow();
  const start = Date.now();
  const marks = {};
  const mark = (n) => {
    marks[n] = (Date.now() - start) / 1000;
  };
  try {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1440, 900),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.nightcode.invoke("snapshot").then((s) => s.engine),
          ),
        { timeout: 60000 },
      )
      .toBe("Ready");
    mark("welcome");
    await page.screenshot({ path: path.join(output, "welcome.png") });
    await page
      .getByRole("textbox", { name: "Message NightCode" })
      .pressSequentially("Build something worth shipping.", { delay: 55 });
    await pause(1200);
    await page.getByRole("textbox", { name: "Message NightCode" }).fill("");
    await page
      .getByRole("button", { name: "Skills & workflows", exact: true })
      .click();
    mark("skills");
    await pause(800);
    await page.screenshot({ path: path.join(output, "skills.png") });
    await page
      .getByRole("button")
      .filter({ hasText: "game-director" })
      .first()
      .click();
    await pause(3500);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, project);
    const p = await page.evaluate(() =>
      window.nightcode.invoke("projects.open"),
    );
    await page.evaluate(
      (baseURL) =>
        window.nightcode.invoke("providers.save", {
          id: "demo",
          name: "Demo provider",
          model: "demo-model",
          baseURL,
          key: "local-demo-only",
          models: [
            {
              id: "demo-model",
              name: "Demo reasoning model",
              reasoning: true,
              variants: {
                low: { reasoningEffort: "low" },
                medium: { reasoningEffort: "medium" },
                high: { reasoningEffort: "high" },
              },
            },
          ],
        }),
      `http://127.0.0.1:${server.address().port}/v1`,
    );
    const s = await page.evaluate(
      (projectId) => window.nightcode.invoke("session.create", { projectId }),
      p.id,
    );
    await page
      .getByRole("button", { name: "Conversation model", exact: true })
      .click();
    mark("models");
    await pause(800);
    await page
      .getByRole("button", { name: "Set low reasoning", exact: true })
      .click();
    await pause(800);
    await page
      .getByRole("button", { name: "Set high reasoning", exact: true })
      .click();
    await pause(1000);
    await page.screenshot({ path: path.join(output, "models.png") });
    await page
      .getByRole("button", { name: "Conversation model", exact: true })
      .click();
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Message NightCode" })
      .pressSequentially("Set player speed to 6 and check the change.", {
        delay: 45,
      });
    mark("work");
    await page
      .getByRole("button", { name: "Send message · Enter", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Review file change/ })
      .waitFor({ timeout: 60000 });
    await pause(1400);
    await page
      .getByRole("button", { name: /Review file change/ })
      .evaluate((el) => el.click());
    mark("review");
    await pause(1600);
    await page.screenshot({ path: path.join(output, "review.png") });
    await page
      .getByRole("button", { name: "Accept change", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Review command/ })
      .waitFor({ timeout: 30000 });
    await page
      .getByRole("button", { name: /Review command/ })
      .evaluate((el) => el.click());
    await pause(1400);
    await page
      .getByRole("button", { name: "Approve once", exact: true })
      .click();
    await page
      .getByText("Player speed is now 6.", { exact: false })
      .waitFor({ timeout: 30000 });
    mark("done");
    await pause(2200);
    await page.screenshot({ path: path.join(output, "work.png") });
  } finally {
    const video = page.video();
    await app.close();
    await video.saveAs(path.join(output, "workspace.webm"));
    server.close();
    await fs.writeFile(
      path.join(output, "capture.json"),
      JSON.stringify(marks, null, 2),
    );
  }
  console.log(
    "Recorded real Electron UI with a labeled local scripted provider.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
