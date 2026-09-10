import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
test("monitors commands and requires fresh real check evidence before completing tasks", async () => {
  test.setTimeout(180000);
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-work-")),
    project = path.join(data, "project");
  await fs.mkdir(project);
  await fs.writeFile(path.join(project, "hello.txt"), "original");
  const requests: any[] = [];
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
              message: { role: "assistant", content: "Evidence task" },
              finish_reason: "stop",
            },
          ],
        }),
      );
      return;
    }
    const outputs = body.messages.filter((m: any) => m.role === "tool");
    const id = (index: number) =>
      String(outputs[index]?.content).match(/"id":"([^"]+)"/)?.[1];
    const calls: [string, any][] = [
      [
        "create_task",
        {
          title: "Verify hello",
          criteria: ["hello.txt has the intended content"],
        },
      ],
      [
        "update_task",
        {
          id: id(0),
          status: "complete",
          assessment: "Premature claim should fail",
        },
      ],
      [
        "start_command",
        {
          command:
            "Write-Output 'monitor-ready'; Start-Sleep -Seconds 1; Write-Output 'monitor-done'",
        },
      ],
      ["read_command", { id: id(2), waitMs: 10000 }],
      [
        "run_check",
        {
          taskId: id(0),
          criteria: [0],
          command:
            "if ((Get-Content hello.txt -Raw) -ne 'original') { exit 1 }; Write-Output 'content verified'",
          files: ["hello.txt"],
        },
      ],
      [
        "update_task",
        {
          id: id(0),
          status: "complete",
          assessment: "The content assertion passed",
        },
      ],
      [
        "replace_in_file",
        { path: "hello.txt", oldText: "original", newText: "updated" },
      ],
      ["audit_tasks", {}],
      [
        "run_check",
        {
          taskId: id(0),
          criteria: [0],
          command:
            "if ((Get-Content hello.txt -Raw) -ne 'updated') { exit 1 }; Write-Output 'updated content verified'",
          files: ["hello.txt"],
        },
      ],
      [
        "update_task",
        {
          id: id(0),
          status: "complete",
          assessment: "Reran the assertion against the updated file",
        },
      ],
      [
        "start_command",
        { command: "Start-Sleep -Seconds 20", timeoutMs: 1000 },
      ],
      ["read_command", { id: id(10), waitMs: 10000 }],
    ];
    const call = calls[outputs.length];
    const delta = call
      ? {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: `call-${outputs.length}`,
              type: "function",
              function: {
                name: body.tools.find((t: any) =>
                  t.function.name.endsWith("_" + call[0]),
                ).function.name,
                arguments: JSON.stringify(call[1]),
              },
            },
          ],
        }
      : { role: "assistant", content: "Task verification finished." };
    res
      .writeHead(200, { "Content-Type": "text/event-stream" })
      .end(
        `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: call ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
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
    await expect(
      page.getByPlaceholder("Ask NightCode to build, fix, or explore…"),
    ).toBeVisible();
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
      async (baseURL) => {
        await window.nightcode.invoke("providers.save", {
          id: "fixture",
          name: "Fixture",
          model: "fixture",
          key: "test",
          baseURL,
        });
        const p = (await window.nightcode.invoke<any>("snapshot")).projects[0];
        const session = await window.nightcode.invoke<any>("session.create", {
          projectId: p.id,
        });
        await window.nightcode.invoke("session.send", {
          id: session.id,
          text: "Verify hello",
          providerId: "fixture",
          model: "fixture",
          mode: "Code",
          permissionMode: "full",
        });
      },
      `http://127.0.0.1:${(server.address() as any).port}/v1`,
    );
    await page
      .getByRole("button", { name: "Verify hello", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("Task verification finished.", { exact: true }),
    ).toBeVisible({ timeout: 90000 });
    const outputs = requests
      .filter((r) => r.stream)
      .at(-1)
      .messages.filter((m: any) => m.role === "tool")
      .map((m: any) => String(m.content));
    expect(outputs[1]).toContain("Completion needs");
    expect(outputs[3]).toContain("monitor-done");
    expect(outputs[7]).toContain('"status":"review"');
    expect(outputs[11]).toContain('"timedOut":true');
    const snap = await page.evaluate(() =>
      window.nightcode.invoke<any>("snapshot"),
    );
    expect(snap.tasks[0].status).toBe("complete");
    expect(snap.tasks[0].checks).toHaveLength(2);
    expect(snap.tasks[0].checks[1].exitCode).toBe(0);
    expect(snap.tasks[0].checks[1].timedOut).toBe(false);
    await expect(page.locator(".banner.error")).toHaveCount(0);
    await page.getByRole("button", { name: /Tasks & checks/ }).click();
    await expect(page.locator("#tasks-panel")).toBeVisible();
    await page.locator("#tasks-panel .work-item > summary").click();
    await page.locator("#tasks-panel .check-record > summary").last().click();
    await expect(page.locator("#tasks-panel .check-record").last()).toContainText(
      "Exit code: 0",
    );
    await page.screenshot({ path: "test-results/task-verification.png" });
    await page.keyboard.press("Escape");
    await fs.writeFile(path.join(project, "hello.txt"), "external change");
    await page.getByRole("button", { name: /Tasks & checks/ }).click();
    await page
      .getByRole("button", { name: "Recheck evidence", exact: true })
      .click();
    await expect(page.locator("#tasks-panel .work-item > summary")).toContainText(
      "Needs review",
    );
    expect(
      (
        await page.evaluate(() => window.nightcode.invoke<any>("snapshot"))
      ).commands.every((c: any) => !c.running),
    ).toBe(true);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(835, 660),
    );
    await expect(
      page.getByPlaceholder("Ask NightCode to build, fix, or explore…"),
    ).toBeInViewport();
    await page.screenshot({
      path: "test-results/task-verification-compact.png",
    });
    await app.close();
    app = await electron.launch({
      args: ["."],
      env: { ...process.env, NIGHTCODE_TEST_DATA: data },
    });
    const restored = await app.firstWindow();
    await restored.locator("h1").waitFor();
    const saved = await restored.evaluate(() =>
      window.nightcode.invoke<any>("snapshot"),
    );
    expect(saved.tasks[0].status).toBe("review");
    expect(saved.tasks[0].checks).toHaveLength(2);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
