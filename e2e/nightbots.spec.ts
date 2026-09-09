import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
test("NightBots creates profiles and drives a sandboxed browser through reviewed tools", async () => {
  test.setTimeout(180000);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nightbots-e2e-"));
  const seen: any[] = [];
  let pagePort = 0;
  const site = http.createServer((_req, res) =>
    res.end(
      '<!doctype html><title>Browser fixture</title><h1>Local research</h1><label>Topic <input aria-label="Topic"></label><button onclick="document.getElementById(\'result\').textContent=document.querySelector(\'input\').value">Search</button><p id="result">Ready</p><a href="/next">Next page</a>',
    ),
  );
  await new Promise<void>((r) => site.listen(0, "127.0.0.1", r));
  pagePort = (site.address() as any).port;
  const provider = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const b = JSON.parse(raw || "{}");
    seen.push(b);
    if (!b.stream) {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            {
              message: { role: "assistant", content: "Browser research" },
              finish_reason: "stop",
            },
          ],
        }),
      );
      return;
    }
    const outputs = b.messages.filter((m: any) => m.role === "tool");
    const content = String(
      outputs.find((o: any) => String(o.content).includes("tabId"))?.content ||
        "",
    );
    const id = content.match(/"tabId":"([^"]+)"/)?.[1];
    const calls: any[] = [
      [
        "memory",
        {
          action: "save",
          title: "Research preference",
          content: "Use original sources",
        },
      ],
      ["browser_open", { url: `http://127.0.0.1:${pagePort}` }],
      ["browser_action", { id, action: "type", ref: "e1", text: "NightCode" }],
      ["browser_action", { id, action: "click", ref: "e2" }],
      ["browser_snapshot", { id }],
      ["write_document", { path: "brief.docx", content: "Research checked" }],
      ["read_document", { path: "brief.docx" }],
    ];
    const call = calls[outputs.length],
      delta = call
        ? {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call-" + outputs.length,
                type: "function",
                function: {
                  name: "nightcode_" + call[0],
                  arguments: JSON.stringify(call[1]),
                },
              },
            ],
          }
        : { role: "assistant", content: "Browser and document verified." };
    res.setHeader("Content-Type", "text/event-stream");
    res.end(
      "data: " +
        JSON.stringify({
          id: "test",
          object: "chat.completion.chunk",
          choices: [
            { index: 0, delta, finish_reason: call ? "tool_calls" : "stop" },
          ],
        }) +
        "\n\ndata: [DONE]\n\n",
    );
  });
  await new Promise<void>((r) => provider.listen(0, "127.0.0.1", r));
  let app = await electron.launch({
    args: ["."],
    env: { ...process.env, NIGHTCODE_TEST_DATA: root },
  });
  try {
    const page = await app.firstWindow();
    page.on('pageerror',e=>console.log('Renderer error:',e.message));
    await expect(
      page.getByRole("heading", { name: "Welcome to NightCode Desktop" }),
    ).toBeVisible();
    await expect(page.locator(".nav-bot-mark")).toBeVisible();
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect
      .poll(() => page.locator("html").getAttribute("data-theme"))
      .toBe("light");
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect
      .poll(() => page.locator("html").getAttribute("data-theme"))
      .toBe("dark");
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.nightcode.invoke<any>("snapshot").then((s) => s.engine),
          ),
        { timeout: 60000 },
      )
      .toBe("Ready");
    await page.evaluate(
      (url) =>
        window.nightcode.invoke("providers.save", {
          id: "fixture",
          name: "Local fixture",
          model: "fixture",
          key: "fixture",
          baseURL: url,
        }),
      `http://127.0.0.1:${(provider.address() as any).port}/v1`,
    );
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, root);
    const project = await page.evaluate(() =>
      window.nightcode.invoke<any>("projects.open"),
    );
    await page
      .getByRole("button", { name: "NightBots Bots", exact: true })
      .click();
    await page.getByRole("button", { name: "Create bot", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Research Bot");
    await page
      .getByLabel("Instructions", { exact: true })
      .fill("Research sources and review results");
    await page.getByLabel("Project", { exact: true }).selectOption(project.id);
    await page.getByRole("button", { name: "Save bot", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Research Bot", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/nightbots-desktop.png" });
    const botData = await page.evaluate(() =>
      window.nightcode.invoke<any>("bots.list"),
    );
    const bot = botData.bots[0];
    await expect(
      page.evaluate(
        (botId) =>
          window.nightcode.invoke("bots.schedule", {
            botId,
            name: "Invalid",
            prompt: "Watch",
            kind: "file",
            watchPath: "../outside.txt",
          }),
        bot.id,
      ),
    ).rejects.toThrow("inside");
    await page.evaluate(() =>
      window.nightcode.invoke("secrets.save", {
        name: "microsoft365",
        origin: "https://graph.microsoft.com",
        value: "fixture-private-value-5678",
      }),
    );
    expect(
      JSON.stringify(
        await page.evaluate(() => window.nightcode.invoke("bots.list")),
      ),
    ).not.toContain("fixture-private");
    await page.getByRole("button", { name: /Start conversation/ }).click();
    await page
      .getByRole("textbox", { name: "Message NightCode" })
      .fill("Research the local page and create a document.");
    await page
      .getByRole("button", { name: "Send message · Enter", exact: true })
      .click();
    for (let i = 0; i < 3; i++) {
      const review = page.getByRole("button", { name: /Review action/ });
      await review.waitFor({ timeout: 60000 });
      await review.evaluate((el) => (el as HTMLElement).click());
      await expect(
        page.getByRole("heading", { name: "Allow this action?" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Approve once", exact: true })
        .click();
    }
    await expect(
      page.getByText("Browser and document verified.", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const sessions = await page.evaluate(() =>
        window.nightcode.invoke<any>("snapshot").then((s) => s.sessions),
      ),
      session = sessions.find((s: any) => s.botId === bot.id);
    const tabs = await page.evaluate(
      (scope) => window.nightcode.invoke<any[]>("browser.list", { scope }),
      session.id,
    );
    expect(tabs).toHaveLength(1);
    const snap = await page.evaluate(
      ({ scope, id }) =>
        window.nightcode.invoke<any>("browser.snapshot", { scope, id }),
      { scope: session.id, id: tabs[0].id },
    );
    expect(snap.text).toContain("NightCode");
    await expect(
      page.evaluate(
        ({ id }) =>
          window.nightcode.invoke("browser.snapshot", {
            scope: "workspace",
            id,
          }),
        { id: tabs[0].id },
      ),
    ).rejects.toThrow("Unknown browser tab");
    await expect(
      page.evaluate(
        ({ scope, id }) =>
          window.nightcode.invoke("browser.navigate", {
            scope,
            id,
            url: "file:///C:/Windows/win.ini",
          }),
        { scope: session.id, id: tabs[0].id },
      ),
    ).rejects.toThrow("HTTP");
    const isolation = await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find(
          (w) =>
            w.getURL().includes("127.0.0.1") &&
            w.getTitle() === "Browser fixture",
        )!
        .executeJavaScript(
          "({bridge:typeof window.nightcode,node:typeof require})",
        ),
    );
    expect(isolation).toEqual({ bridge: "undefined", node: "undefined" });
    expect(
      await fs.stat(path.join(root, "brief.docx")).then((s) => s.size),
    ).toBeGreaterThan(1000);
    expect(
      seen.some((b) => JSON.stringify(b).includes("Research checked")),
    ).toBeTruthy();
    await page
      .getByRole("button", { name: "Close browser", exact: true })
      .click();
    await page
      .getByRole("button", { name: "NightBots Bots", exact: true })
      .click();
    await page.setViewportSize({ width: 820, height: 650 });
    await page.screenshot({ path: "test-results/nightbots-small.png" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await app.close();
    app = await electron.launch({
      args: ["."],
      env: { ...process.env, NIGHTCODE_TEST_DATA: root },
    });
    const restored = await app.firstWindow();
    await restored.waitForSelector("h1");
    const state = await restored.evaluate(() =>
      window.nightcode.invoke<any>("bots.list"),
    );
    expect(state.bots[0].name).toBe("Research Bot");
    expect(state.memories[0].content).toBe("Use original sources");
  } finally {
    await app.close();
    site.close();
    provider.close();
  }
});
