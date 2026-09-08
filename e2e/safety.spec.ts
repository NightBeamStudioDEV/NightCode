import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("rejection, conflicts, deletion, read-only mode, outside access and cancellation", async () => {
  test.setTimeout(180000);
  let requested = {
    name: "propose_edit",
    args: { path: "file.txt", content: "agent" } as any,
  };
  let unauthorized = false;
  const server = http.createServer(async (req, res) => {
    if (unauthorized) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          error: { message: "Invalid API key", type: "authentication_error" },
        }),
      );
      return;
    }
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw || "{}");
    if (!body.stream) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          id: "title",
          choices: [
            {
              message: { role: "assistant", content: "Safety fixture" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
      return;
    }
    const done = body.messages?.some((m: any) => m.role === "tool");
    const tool = body.tools?.find((t: any) =>
      t.function.name.endsWith(requested.name),
    );
    const choice = done
      ? {
          index: 0,
          delta: { role: "assistant", content: "Finished." },
          finish_reason: "stop",
        }
      : {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call_safety",
                type: "function",
                function: {
                  name: tool?.function.name || "nightcode_" + requested.name,
                  arguments: JSON.stringify(requested.args),
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        };
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      "data: " +
        JSON.stringify({
          id: "fixture",
          object: "chat.completion.chunk",
          created: 1,
          model: "fixture",
          choices: [choice],
        }) +
        "\n\ndata: [DONE]\n\n",
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-safety-"));
  const project = await fs.mkdtemp(
    path.join(os.tmpdir(), "nightcode-safety-project-"),
  );
  const outside = await fs.mkdtemp(
    path.join(os.tmpdir(), "nightcode-outside-"),
  );
  await fs.writeFile(path.join(project, "file.txt"), "original");
  await fs.writeFile(path.join(outside, "external.txt"), "private");
  // Project configuration must not expand the engine's tool permissions.
  await fs.writeFile(
    path.join(project, "opencode.json"),
    JSON.stringify({ permission: "allow", plugin: ["./unapproved.js"] }),
  );
  await fs.writeFile(
    path.join(project, "unapproved.js"),
    "throw new Error('Project plugins must not load')",
  );
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
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, project);
    const p = await page.evaluate(() =>
      window.nightcode.invoke<any>("projects.open"),
    );
    await page.evaluate(
      (baseURL) =>
        window.nightcode.invoke("providers.save", {
          id: "fixture",
          name: "Fixture",
          model: "fixture",
          baseURL,
          key: "nightcode-secret-never-plaintext",
        }),
      `http://127.0.0.1:${(server.address() as any).port}/v1`,
    );
    const send = async (mode = "Code") => {
      await expect
        .poll(async () => (await snapshot()).activeSessionId)
        .toBeFalsy();
      const s = await page.evaluate(
        (projectId) =>
          window.nightcode.invoke<any>("session.create", { projectId }),
        p.id,
      );
      await page.evaluate(
        ({ id, mode }) =>
          window.nightcode.invoke("session.send", {
            id,
            text: "Perform the safety fixture operation.",
            providerId: "fixture",
            model: "fixture",
            mode,
            attachments: [],
          }),
        { id: s.id, mode },
      );
      return s.id;
    };
    const pending = async (kind: string) => {
      await expect
        .poll(
          async () =>
            (await snapshot()).approvals.find(
              (a: any) => a.kind === kind && a.status === "pending",
            ),
          { timeout: 30000 },
        )
        .toBeTruthy();
      return (await snapshot()).approvals.find(
        (a: any) => a.kind === kind && a.status === "pending",
      );
    };
    const reply = (id: string, accept: boolean) =>
      page.evaluate((data) => window.nightcode.invoke("approval.reply", data), {
        id,
        accept,
      });
    const idle = () =>
      expect
        .poll(async () => (await snapshot()).activeSessionId, {
          timeout: 30000,
        })
        .toBeFalsy();
    await send();
    let approval = await pending("edit");
    await reply(approval.id, false);
    await idle();
    expect(await fs.readFile(path.join(project, "file.txt"), "utf8")).toBe(
      "original",
    );
    await expect(reply(approval.id, true)).rejects.toThrow("no longer pending");
    await send();
    approval = await pending("edit");
    await fs.writeFile(path.join(project, "file.txt"), "concurrent user edit");
    await reply(approval.id, true);
    await idle();
    expect(await fs.readFile(path.join(project, "file.txt"), "utf8")).toBe(
      "concurrent user edit",
    );
    requested.args.content = null;
    await send();
    approval = await pending("edit");
    expect(approval.after).toBeNull();
    await reply(approval.id, true);
    await idle();
    await expect(fs.stat(path.join(project, "file.txt"))).rejects.toThrow();
    requested.args.content = "should not exist";
    await send("Plan");
    await idle();
    await expect(fs.stat(path.join(project, "file.txt"))).rejects.toThrow();
    expect(
      (await snapshot()).approvals.filter((a: any) => a.status === "pending"),
    ).toHaveLength(0);
    requested = {
      name: "read_file",
      args: { path: path.join(outside, "external.txt") },
    };
    await send();
    approval = await pending("access");
    await reply(approval.id, false);
    await idle();
    requested = {
      name: "run_command",
      args: { command: "Set-Content -LiteralPath 'blocked.txt' -Value 'bad'" },
    };
    await send();
    approval = await pending("command");
    await reply(approval.id, false);
    await idle();
    await expect(fs.stat(path.join(project, "blocked.txt"))).rejects.toThrow();
    requested.args.command = "Start-Sleep -Seconds 60; Write-Output never";
    await send();
    approval = await pending("command");
    await reply(approval.id, true);
    await expect
      .poll(async () => (await snapshot()).commands.find((c: any) => c.running))
      .toBeTruthy();
    const cmd = (await snapshot()).commands.find((c: any) => c.running);
    await page.evaluate(
      (id) => window.nightcode.invoke("commands.cancel", { id }),
      cmd.id,
    );
    await idle();
    expect(
      (await snapshot()).commands.find((c: any) => c.id === cmd.id).stdout,
    ).not.toContain("never");
    requested = {
      name: "propose_edit",
      args: { path: "pending.txt", content: "not applied" },
    };
    const interrupted = await send();
    approval = await pending("edit");
    await page.evaluate(
      (id) => window.nightcode.invoke("session.abort", { id }),
      interrupted,
    );
    await idle();
    expect(
      (await snapshot()).approvals.find((a: any) => a.id === approval.id)
        .status,
    ).not.toBe("pending");
    await expect(fs.stat(path.join(project, "pending.txt"))).rejects.toThrow();
    unauthorized = true;
    await send();
    await idle();
    await expect(page.getByRole("alert").first()).toBeVisible();
    async function checkSecrets(dir: string) {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) await checkSecrets(file);
        else if ((await fs.stat(file)).size < 10 * 1024 * 1024)
          expect(
            (await fs.readFile(file)).includes(
              Buffer.from("nightcode-secret-never-plaintext"),
            ),
            file,
          ).toBe(false);
      }
    }
    await app.close();
    await checkSecrets(data);
  } finally {
    await app.close().catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
