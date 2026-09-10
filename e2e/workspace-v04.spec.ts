import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

test("repository menu, shared library, model refresh and conversational bot view", async () => {
  test.setTimeout(180000);
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-v04-"));
  const repo = path.join(data, "project");
  await fs.mkdir(repo);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, windowsHide: true }).toString();
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  await fs.writeFile(path.join(repo, "sample.txt"), "first\n");
  git("add", ".");
  git("commit", "-m", "Initial");
  await fs.writeFile(path.join(repo, "sample.txt"), "second\n");
  const requests: any[] = [];
  const server = http.createServer(async (req, res) => {
    if (req.url?.endsWith("/models")) {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            data: [
              { id: "fixture" },
              { id: "new-model", name: "Discovered model" },
            ],
          }),
        );
      return;
    }
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw || "{}");
    requests.push(body);
    if (!body.stream) {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            choices: [
              {
                message: { role: "assistant", content: "Friendly chat" },
                finish_reason: "stop",
              },
            ],
          }),
        );
      return;
    }
    res
      .writeHead(200, { "Content-Type": "text/event-stream" })
      .end(
        "data: " +
          JSON.stringify({
            id: "fixture",
            object: "chat.completion.chunk",
            choices: [
              {
                index: 0,
                delta: {
                  role: "assistant",
                  content: "Hello! What would you like to talk about?",
                },
                finish_reason: "stop",
              },
            ],
          }) +
          "\n\ndata: [DONE]\n\n",
      );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const app = await electron.launch({
    args: ["."],
    env: { ...process.env, NIGHTCODE_TEST_DATA: data },
  });
  try {
    const page = await app.firstWindow();
    const snapshot = () =>
      page.evaluate(() => window.nightcode.invoke<any>("snapshot"));
    await expect
      .poll(async () => (await snapshot()).engine, { timeout: 60000 })
      .toBe("Ready");
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, repo);
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    const project = (await snapshot()).projects[0];
    await page.evaluate(
      async ({ baseURL, projectId }) => {
        await window.nightcode.invoke("providers.save", {
          id: "fixture",
          name: "Fixture",
          model: "fixture",
          baseURL,
          key: "test",
        });
        await window.nightcode.invoke("session.create", { projectId });
      },
      {
        baseURL: "http://127.0.0.1:" + (server.address() as any).port + "/v1",
        projectId: project.id,
      },
    );
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Repository", exact: true }).click();
    await expect(page.getByLabel("Repository branch")).toBeVisible();
    await page
      .getByRole("button", { name: "Changes", exact: false })
      .filter({ hasText: "Changes" })
      .first()
      .click();
    await expect(page.locator(".git-output")).toContainText("+second");
    await page.getByRole("button", { name: "Stage all", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Stage all", exact: true }),
    ).toBeEnabled();
    await page
      .getByLabel("Commit message", { exact: true })
      .fill("Reviewed in the UI");
    await page.getByRole("button", { name: "Commit", exact: true }).click();
    await expect(page.locator(".git-output")).toContainText(
      "Reviewed in the UI",
    );
    expect(git("log", "-1", "--format=%s").trim()).toBe("Reviewed in the UI");
    await page.getByLabel("New branch name").fill("test-branch");
    await page
      .getByRole("button", { name: "Create branch", exact: true })
      .click();
    await expect(page.locator(".git-current")).toContainText("test-branch");
    await page.screenshot({
      path: "test-results/v04-repository.png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Skills & toolkits", exact: true })
      .click();
    await expect(page.locator(".toolkit-library")).toContainText(
      "@toolkit:browser",
    );
    await page.screenshot({
      path: "test-results/v04-library.png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Conversation model", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Refresh models", exact: true })
      .click();
    await expect(page.locator(".model-list")).toContainText(
      "Discovered model",
      { timeout: 60000 },
    );
    await page.screenshot({ path: "test-results/v04-model-picker.png", animations: "disabled" });
    await page
      .getByRole("button", { name: "Add or rename model", exact: true })
      .click();
    await page.getByLabel("Model ID", { exact: true }).fill("new-model");
    await page
      .getByLabel("Display name", { exact: true })
      .fill("My friendly model");
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Conversation model", exact: true }),
    ).toContainText("My friendly model", { timeout: 60000 });
    const models = await page.evaluate(() =>
      window.nightcode.invoke<any[]>("providers.list"),
    );
    expect(
      models
        .find((p) => p.id === "fixture")
        .models.find((m: any) => m.id === "new-model").name,
    ).toBe("My friendly model");
    await page.evaluate(
      (projectId) =>
        window.nightcode.invoke("bots.save", {
          name: "Friendly bot",
          description: "Let's talk",
          instructions: "Be friendly",
          projectId,
          providerId: "fixture",
          model: "new-model",
          color: "blue",
        }),
      project.id,
    );
    await page.getByRole("switch", { name: "Bots view", exact: true }).click();
    await page
      .getByRole("button", { name: "New chat with Friendly bot", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Message NightCode" })
      .fill("Hello");
    await page
      .getByRole("textbox", { name: "Message NightCode" })
      .press("Enter");
    await expect(
      page.getByText("Hello! What would you like to talk about?", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 60000 });
    await expect(page.locator(".app")).toHaveClass(/bot-view/);
    expect(JSON.stringify(requests)).toContain(
      "personal conversational assistant",
    );
    await page.screenshot({
      path: "test-results/v04-bot-chat.png",
      animations: "disabled",
    });
    await page.getByRole("switch", { name: "Bots view", exact: true }).click();
    await expect(page.locator(".app")).not.toHaveClass(/bot-view/);
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await page.getByRole("button", { name: "Repository", exact: true }).click();
    await expect(page.getByLabel("Repository branch")).toBeVisible();
    await page.screenshot({
      path: "test-results/v04-repository-light.png",
      animations: "disabled",
    });
  } finally {
    await app.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
