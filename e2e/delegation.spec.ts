import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("delegates through isolated brokers, enforces ownership, and manages skills and roots", async () => {
  test.setTimeout(180000);
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-team-"));
  const root = path.join(data, "project"),
    second = path.join(data, "assets");
  await fs.mkdir(root);
  await fs.mkdir(second);
  await fs.writeFile(path.join(second, "allowed.txt"), "original");
  await fs.writeFile(path.join(root, "protected.txt"), "untouched");
  const requests: any[] = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    requests.push(body);
    if (!body.stream) {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            choices: [
              {
                message: { role: "assistant", content: "Delegation" },
                finish_reason: "stop",
              },
            ],
          }),
        );
      return;
    }
    const outputs = (body.messages || []).filter((m: any) => m.role === "tool");
    const child = JSON.stringify(body.messages).includes("Role: code.");
    let call: [string, any] | undefined;
    if (child) {
      call = (
        [
          [
            "replace_in_file",
            {
              path: path.join(root, "protected.txt"),
              oldText: "untouched",
              newText: "bad",
            },
          ],
          [
            "replace_in_file",
            {
              path: path.join(second, "allowed.txt"),
              oldText: "original",
              newText: "updated",
            },
          ],
        ] as [string, any][]
      )[outputs.length];
    } else if (!outputs.length)
      call = [
        "spawn_agent",
        {
          title: "Update asset",
          role: "code",
          task: "Change original to updated in allowed.txt",
          paths: [path.join(second, "allowed.txt")],
        },
      ];
    else if (
      !outputs.some((m: any) =>
        String(m.content).includes('"status":"complete"'),
      )
    ) {
      const match = String(outputs[0].content).match(/"id":"([^"]+)"/);
      call = ["wait_agent", { id: match?.[1] }];
    }
    const delta = call
      ? {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: `call-${outputs.length}`,
              type: "function",
              function: {
                name: `nightcode_${call[0]}`,
                arguments: JSON.stringify(call[1]),
              },
            },
          ],
        }
      : {
          role: "assistant",
          content: child
            ? "Asset updated; ownership rejection respected."
            : "Delegation verified.",
        };
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: call ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const app = await electron.launch({
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
    await app.evaluate(
      ({ dialog }, roots) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: roots,
        });
      },
      [root, second],
    );
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    const p = await page.evaluate(() =>
      window.nightcode.invoke<any>("snapshot").then((s) => s.projects[0]),
    );
    expect(p.roots).toEqual(await Promise.all([root, second].map((folder) => fs.realpath(folder))));
    await page.evaluate(
      async ({ p, baseURL }) => {
        await window.nightcode.invoke("projects.update", {
          id: p.id,
          name: "Two folders",
          roots: p.roots,
        });
        await window.nightcode.invoke("skills.save", {
          id: "team-check",
          description: "Team checks",
          content: "Require ownership evidence TEAM_SKILL_MARKER",
        });
        await window.nightcode.invoke("providers.save", {
          id: "fixture",
          name: "Fixture",
          model: "fixture",
          key: "test",
          baseURL,
        });
      },
      { p, baseURL: `http://127.0.0.1:${(server.address() as any).port}/v1` },
    );
    const input = page.getByRole("textbox", { name: "Message NightCode" });
    await input.fill("@team-");
    await page.getByRole("button", { name: /@team-check/ }).click();
    await input.fill("@team-check Delegate the asset change");
    await input.press("Enter");
    await expect(page.locator(".subagent-cards")).toContainText(
      "Update asset",
      { timeout: 60000 },
    );
    await page.locator(".subagent-cards button").click();
    await expect(page.locator(".spectator")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Review file change/ }),
    ).toBeVisible({ timeout: 60000 });
    expect(await fs.readFile(path.join(second, "allowed.txt"), "utf8")).toBe(
      "original",
    );
    await page.getByRole("button", { name: /Review file change/ }).click();
    await page
      .getByRole("button", { name: "Accept change", exact: true })
      .click();
    await expect(
      page.getByText("Delegation verified.", { exact: true }),
    ).toBeVisible({ timeout: 60000 });
    expect(await fs.readFile(path.join(second, "allowed.txt"), "utf8")).toBe(
      "updated",
    );
    expect(await fs.readFile(path.join(root, "protected.txt"), "utf8")).toBe(
      "untouched",
    );
    expect(JSON.stringify(requests)).toContain("TEAM_SKILL_MARKER");
    expect(JSON.stringify(requests)).toContain(
      "outside your assigned edit ownership",
    );
    await page.screenshot({ path: "test-results/subagent-spectator.png" });
    await page
      .getByRole("button", { name: "Skills & workflows", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search skills" })
      .fill("team-check");
    await page.locator(".skill-grid button").click();
    await page
      .getByRole("button", { name: "Delete skill", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove skill", exact: true })
      .click();
    await expect(page.locator(".skill-grid button")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Search skills" }).fill("");
    await expect(page.locator(".skill-grid button")).toHaveCount(9);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(760, 600);
    });
    const box = await page.locator(".skills-modal").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(600);
    await page.locator(".skill-manager").evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole("button", { name: "Close dialog", exact: true })).toBeInViewport();
    await page.screenshot({ path: "test-results/skills-responsive.png" });
    await page.getByRole("button", { name: "Add skill", exact: false }).click();
    await page.getByLabel("Skill name", { exact: true }).fill("ui-workflow");
    await page.getByLabel("Description", { exact: true }).fill("Added through the UI");
    await page.getByLabel("Instructions", { exact: true }).fill("Check resizing and input.");
    await page.getByRole("button", { name: "Save skill", exact: true }).click();
    await expect(page.locator(".skill-reader")).toContainText("Check resizing and input.");
    await page.getByRole("button", { name: "Edit skill", exact: true }).click();
    await page.getByLabel("Instructions", { exact: true }).fill("Check resizing, input, and audio.");
    await page.getByRole("button", { name: "Save skill", exact: true }).click();
    await expect(page.locator(".skill-reader")).toContainText("input, and audio");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Edit project Two folders", exact: true }).click();
    await page.getByLabel("Project name", { exact: true }).fill("Renamed project");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.locator(".project-group-heading")).toContainText("Renamed project");
    await page.getByRole("button", { name: "Edit project Renamed project", exact: true }).first().click();
    await page.getByRole("button", { name: "Remove project", exact: true }).click();
    await page.getByRole("button", { name: "Remove from NightCode", exact: true }).click();
    expect(await fs.readFile(path.join(second, "allowed.txt"), "utf8")).toBe(
      "updated",
    );
    expect(
      (await page.evaluate(() => window.nightcode.invoke<any>("snapshot")))
        .sessions[0].projectId,
    ).toBe("");
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
