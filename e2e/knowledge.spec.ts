import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
test("slash modes, skill discovery, batched tools and persistent goal through real engine", async () => {
  test.setTimeout(180000);
  const requests: any[] = [];
  const calls = [
    [
      "ask_user",
      {
        question: "Which camera should I use?",
        context: "This affects controls and level layout.",
        options: ["First person", "Third person"],
      },
    ],
    ["list_skills", {}],
    ["load_skill", { id: "game-director" }],
    ["inspect_project", {}],
    [
      "read_files",
      { files: [{ path: "hello.txt", startLine: 1, lineCount: 10 }] },
    ],
    ["get_goal", {}],
    [
      "replace_in_file",
      { path: "hello.txt", oldText: "original", newText: "updated" },
    ],
    [
      "update_goal",
      {
        status: "complete",
        criteria: ["Update hello.txt"],
        evidence: "Read file and applied the unique reviewed replacement.",
      },
    ],
  ];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    requests.push(body);
    if (!body.stream) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          choices: [
            {
              message: { role: "assistant", content: "Game goal" },
              finish_reason: "stop",
            },
          ],
        }),
      );
      return;
    }
    const outputs = (body.messages || []).filter((m: any) => m.role === "tool");
    const entry = calls[outputs.length];
    const choice = entry
      ? {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: `call-${outputs.length}`,
                type: "function",
                function: {
                  name: body.tools.find((t: any) =>
                    t.function.name.endsWith("_" + entry[0]),
                  ).function.name,
                  arguments: JSON.stringify(entry[1]),
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        }
      : {
          index: 0,
          delta: { role: "assistant", content: "Goal verified." },
          finish_reason: "stop",
        };
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    if (outputs.length === 0) {
      res.write(
        `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", reasoning_content: "I need to clarify the camera before selecting controls." }, finish_reason: null }] })}\n\n`,
      );
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    res.end(
      `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", choices: [choice] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-knowledge-")),
    project = await fs.mkdtemp(
      path.join(os.tmpdir(), "nightcode-knowledge-project-"),
    );
  await fs.writeFile(path.join(project, "hello.txt"), "original\n");
  let app = await electron.launch({
    args: ["."],
    env: { ...process.env, NIGHTCODE_TEST_DATA: data },
  });
  try {
    const page = await app.firstWindow();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.nightcode.invoke<any>("snapshot").then((s) => s.engine),
          ),
        { timeout: 60000 },
      )
      .toBe("Ready");
    const input = page.getByRole("textbox", { name: "Message NightCode" });
    await input.fill("/plan mode");
    await input.press("Enter");
    await expect(page.locator(".mode-indicator")).toContainText("read-only");
    await input.fill("/skills");
    await input.press("Enter");
    await expect(page.locator(".skill-grid > button")).toHaveCount(9);
    await page
      .locator(".skill-grid > button")
      .filter({ hasText: "game director" })
      .click();
    await expect(page.locator(".skill-reader")).toContainText("vertical slice");
    await page.screenshot({ path: "test-results/game-skill-library.png" });
    await page.keyboard.press("Escape");
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, project);
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    await page.evaluate(
      (baseURL) =>
        window.nightcode.invoke("providers.save", {
          id: "fixture",
          name: "Fixture",
          model: "fixture",
          baseURL,
          key: "test",
        }),
      `http://127.0.0.1:${(server.address() as any).port}/v1`,
    );
    await input.fill("/goal Update hello.txt and verify the change");
    await input.press("Enter");
    await expect(page.locator(".goal-card")).toContainText("Update hello.txt");
    await expect(
      page.getByRole("region", { name: "Agent question" }),
    ).toBeVisible({ timeout: 60000 });
    await expect(page.locator(".reasoning-message")).toContainText(
      "I need to clarify the camera before selecting controls.",
    );
    await page
      .getByRole("button", { name: "Third person", exact: true })
      .click();
    await page
      .getByLabel("Your answer", { exact: true })
      .fill("Third person with keyboard and mouse");
    await page.screenshot({
      path: "test-results/agent-question-reasoning.png",
    });
    await page
      .getByRole("button", { name: "Send answer", exact: true })
      .click();

    await expect(
      page.getByRole("button", { name: /Review file change/ }),
    ).toBeVisible({ timeout: 60000 });
    expect(await fs.readFile(path.join(project, "hello.txt"), "utf8")).toBe(
      "original\n",
    );
    await page.getByRole("button", { name: /Review file change/ }).click();
    await page
      .getByRole("button", { name: "Accept change", exact: true })
      .click();
    await expect(page.getByText("Goal verified.", { exact: true })).toBeVisible(
      { timeout: 60000 },
    );
    expect(await fs.readFile(path.join(project, "hello.txt"), "utf8")).toBe(
      "updated\n",
    );
    await expect(page.locator(".goal-card")).toContainText("complete");
    await expect(page.locator(".goal-achieved")).toContainText(
      "Goal achieved.",
    );
    const tools = requests
      .filter((r) => r.stream)
      .at(-1)
      .tools.map((t: any) => t.function.name);
    for (const [name] of calls)
      expect(
        tools.some((tool: string) => tool.endsWith("_" + name)),
      ).toBeTruthy();
    const outputs = requests
      .filter((r) => r.stream)
      .at(-1)
      .messages.filter((m: any) => m.role === "tool")
      .map((m: any) => m.content)
      .join("\n");
    expect(outputs).toContain("game-director");
    expect(outputs).toContain("original");
    expect(outputs).toContain("Third person with keyboard and mouse");
    expect(outputs).not.toContain("Unknown tool");
    await page.screenshot({ path: "test-results/game-goal-complete.png" });
    const snapshot = await page.evaluate(() =>
      window.nightcode.invoke<any>("snapshot"),
    );
    await app.close();
    app = await electron.launch({
      args: ["."],
      env: { ...process.env, NIGHTCODE_TEST_DATA: data },
    });
    const restored = await app.firstWindow();
    await restored.locator("h1").waitFor();
    expect(
      (await restored.evaluate(() => window.nightcode.invoke<any>("snapshot")))
        .goals,
    ).toEqual(snapshot.goals);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
