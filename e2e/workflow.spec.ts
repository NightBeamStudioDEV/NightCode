import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
test("custom providers, reasoning, project chats, permissions, Enter and prompt queue", async () => {
  test.setTimeout(180000);
  const requests: any[] = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw || "{}");
    requests.push(body);
    if (!body.stream) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          id: "title",
          choices: [
            {
              message: { role: "assistant", content: "Workflow test" },
              finish_reason: "stop",
            },
          ],
        }),
      );
      return;
    }
    const lastUser = body.messages
      ?.filter((m: any) => m.role === "user")
      .at(-1);
    const content =
      typeof lastUser?.content === "string"
        ? lastUser.content
        : JSON.stringify(lastUser?.content);
    const lastTool = body.messages?.at(-1)?.role === "tool";
    const needsEdit = content?.includes("edit file") && !lastTool;
    const tool = body.tools?.find((t: any) =>
      t.function.name.endsWith("propose_edit"),
    );
    const choice = needsEdit
      ? {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "edit-" + Date.now(),
                type: "function",
                function: {
                  name: tool?.function.name,
                  arguments: JSON.stringify({
                    path: "test.txt",
                    content: content.includes("full") ? "full" : "auto",
                  }),
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        }
      : {
          index: 0,
          delta: { role: "assistant", content: "Finished: " + content },
          finish_reason: "stop",
        };
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      "data: " +
        JSON.stringify({
          id: "fixture",
          object: "chat.completion.chunk",
          created: 1,
          model: "gpt-5-test",
          choices: [choice],
        }) +
        "\n\ndata: [DONE]\n\n",
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-workflow-"));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-projects-"));
  await fs.mkdir(path.join(root, "Alpha"));
  await fs.mkdir(path.join(root, "Beta"));
  const app = await electron.launch({
    args: ["."],
    env: { ...process.env, NIGHTCODE_TEST_DATA: data },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    const snapshot = () =>
      page.evaluate(() => window.nightcode.invoke<any>("snapshot"));
    await expect
      .poll(async () => (await snapshot()).engine, { timeout: 60000 })
      .toBe("Ready");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.screenshot({ path: "test-results/provider-selection.png" });
    await page
      .getByRole("button", { name: "Add custom provider", exact: true })
      .click();
    await page.getByLabel("Provider ID", { exact: true }).fill("local-one");
    await page.getByLabel("Display name", { exact: true }).fill("Local One");
    await page.getByLabel("API key", { exact: true }).fill("fixture");
    await page
      .getByLabel("Base URL", { exact: false })
      .fill(`http://127.0.0.1:${(server.address() as any).port}/v1`);
    await page
      .getByRole("button", { name: "Choose model", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add custom model", exact: true })
      .click();
    await page.getByLabel("Model ID", { exact: true }).fill("gpt-5-test");
    await page
      .getByLabel("Display name", { exact: true })
      .fill("Test reasoning model");
    await page.getByLabel(/Supports OpenAI-compatible reasoning/).check();
    await page.getByRole("button", { name: "Add model", exact: true }).click();
    await page
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
    const p2 = {
      id: "local-two",
      name: "Local Two",
      model: "other-model",
      baseURL: `http://127.0.0.1:${(server.address() as any).port}/v1`,
      key: "second",
    };
    await page.evaluate(
      (p) => window.nightcode.invoke("providers.save", p),
      p2,
    );
    expect((await snapshot()).providers).toHaveLength(2);
    await app.evaluate(
      ({ dialog }, folder) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [folder],
        });
      },
      path.join(root, "Alpha"),
    );
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    const input = page.getByRole("textbox", { name: "Message NightCode" });
    await expect(input).toHaveAttribute("placeholder", "Ask NightCode to build, fix, or explore…");
    await input.fill("edit file first");
    await input.press("Shift+Enter");
    await expect(input).toHaveValue("edit file first\n");
    await input.press("Enter");
    await expect(
      page.getByRole("button", { name: /Review file change/ }),
    ).toBeVisible();
    await expect(page.locator(".viewer")).toHaveCount(0);
    await input.fill("queued A");
    await input.press("Enter");
    await expect(page.locator(".queue-item")).toHaveCount(1);
    await expect(input).toHaveValue("");
    await input.fill("queued B");
    await expect(
      page.getByRole("button", { name: "Queue prompt · Enter", exact: true }),
    ).toBeEnabled();
    await input.press("Enter");
    await expect(page.locator(".queue-item")).toHaveCount(2);
    await page
      .locator(".queue-item")
      .filter({ hasText: "queued B" })
      .getByRole("button", { name: "Edit queued prompt" })
      .click();
    await page
      .getByLabel("Queued prompt", { exact: true })
      .fill("queued B edited");
    await page.getByRole("button", { name: "Save queued prompt" }).click();
    await page
      .locator(".queue-item")
      .filter({ hasText: "queued B edited" })
      .getByRole("button", { name: "Move prompt next" })
      .click();
    await expect(page.locator(".queue-item").first()).toContainText(
      "queued B edited",
    );
    await page
      .locator(".queue-item")
      .filter({ hasText: "queued A" })
      .getByRole("button", { name: "Remove queued prompt" })
      .click();
    await input.fill("queued C automatic");
    await expect(
      page.getByRole("button", { name: "Queue prompt · Enter", exact: true }),
    ).toBeEnabled();
    await input.press("Enter");
    await expect(page.locator(".queue-item")).toHaveCount(2);
    await page.screenshot({ path: "test-results/queued-prompts.png" });
    await page
      .locator(".queue-item")
      .filter({ hasText: "queued B edited" })
      .getByRole("button", { name: "Send now", exact: true })
      .click();
    await expect.poll(async () => (await snapshot()).queue.length).toBe(0);
    await expect(
      page.getByText("Finished: queued C automatic", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await snapshot()).activeSessionId)
      .toBeFalsy();
    expect(
      (await snapshot()).approvals.every((a: any) => a.status !== "pending"),
    ).toBeTruthy();
    await expect(
      fs.stat(path.join(root, "Alpha", "test.txt")),
    ).rejects.toThrow();
    await page
      .getByRole("button", { name: "Ask for approval", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Approve for me.*Allow project edits/ })
      .click();
    await input.fill("edit file auto");
    await input.press("Enter");
    await expect
      .poll(() =>
        fs
          .readFile(path.join(root, "Alpha", "test.txt"), "utf8")
          .catch(() => null),
      )
      .toBe("auto");
    await expect
      .poll(async () => (await snapshot()).activeSessionId)
      .toBeFalsy();
    await expect(page.locator(".viewer")).toHaveCount(0);
    await expect(page.locator(".terminal-panel")).toHaveCount(0);
    await page.getByRole("button", { name: "Conversation model" }).click();
    const slider = page.getByRole("slider", { name: "Reasoning effort" });
    await expect(slider).toBeEnabled();
    await slider.fill("3");
    await page.screenshot({ path: "test-results/reasoning-menu.png" });
    await page.keyboard.press("Escape");
    await input.fill("reasoning request");
    await input.press("Enter");
    await expect
      .poll(async () => (await snapshot()).activeSessionId)
      .toBeFalsy();
    await expect
      .poll(() => requests.some((r) => r.reasoning_effort === "high"))
      .toBeTruthy();
    await page
      .getByRole("button", { name: "Approve for me", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Full access.*Allow file and command/ })
      .click();
    await input.fill("edit file full");
    await input.press("Enter");
    await expect
      .poll(() =>
        fs
          .readFile(path.join(root, "Alpha", "test.txt"), "utf8")
          .catch(() => null),
      )
      .toBe("full");
    await expect
      .poll(async () => (await snapshot()).activeSessionId)
      .toBeFalsy();
    await app.evaluate(
      ({ dialog }, folder) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [folder],
        });
      },
      path.join(root, "Beta"),
    );
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    await input.fill("Beta conversation");
    await input.press("Enter");
    await expect
      .poll(async () => (await snapshot()).activeSessionId)
      .toBeFalsy();
    await expect(
      page.locator(".project-group").filter({ hasText: "Alpha" }),
    ).toContainText("edit file first");
    await expect(
      page.locator(".project-group").filter({ hasText: "Beta" }),
    ).toContainText("Beta conversation");
    await page.screenshot({ path: "test-results/project-conversations.png" });
  } catch (e) {
    console.log(
      "Reasoning requests",
      requests.map((r) => ({
        model: r.model,
        effort: r.reasoning_effort,
        keys: Object.keys(r),
      })),
    );
    throw e;
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
