import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("real engine routes tool calls through edit and command approvals", async () => {
  const requests: any[] = [];
  let toolNames: string[] = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw || "{}");
    requests.push(body);
    toolNames = (body.tools || []).map((t: any) => t.function.name);
    const outputs = (body.messages || []).filter((m: any) => m.role === "tool");
    let call: any;
    const names = (suffix: string) => toolNames.find((n) => n.endsWith(suffix));
    if (outputs.length === 0)
      call = {
        name: names("read_file"),
        arguments: JSON.stringify({ path: "hello.txt" }),
      };
    else if (outputs.length === 1)
      call = {
        name: names("propose_edit"),
        arguments: JSON.stringify({ path: "hello.txt", content: "reviewed\n" }),
      };
    else if (outputs.length === 2)
      call = {
        name: names("run_command"),
        arguments: JSON.stringify({
          command: "Write-Output 'nightcode-test-ok'",
        }),
      };
    const choice = call
      ? {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call_" + outputs.length,
                type: "function",
                function: call,
              },
            ],
          },
          finish_reason: "tool_calls",
        }
      : {
          index: 0,
          delta: {
            role: "assistant",
            content: "Completed the reviewed change and test.",
          },
          finish_reason: "stop",
        };
    if (body.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(
        "data: " +
          JSON.stringify({
            id: "chat-fixture",
            object: "chat.completion.chunk",
            created: 1,
            model: "fixture",
            choices: [choice],
          }) +
          "\n\n",
      );
      res.end("data: [DONE]\n\n");
    } else {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          id: "chat-fixture",
          object: "chat.completion",
          created: 1,
          model: "fixture",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Fixture title" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-agent-"));
  const project = await fs.mkdtemp(
    path.join(os.tmpdir(), "nightcode-agent-project-"),
  );
  await fs.writeFile(path.join(project, "hello.txt"), "original\n");
  const app = await electron.launch({
    args: ["."],
    env: { ...process.env, NIGHTCODE_TEST_DATA: data },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.nightcode.invoke<any>("snapshot").then((s) => s.engine),
          ),
        { timeout: 60000 },
      )
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
          key: "fixture-secret-test",
        }),
      `http://127.0.0.1:${port}/v1`,
    );
    const s = await page.evaluate(
      (projectId) =>
        window.nightcode.invoke<any>("session.create", { projectId }),
      p.id,
    );
    const imageFile = path.join(project, "image.png");
    await fs.writeFile(
      imageFile,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/S8AAAAASUVORK5CYII=",
        "base64",
      ),
    );
    await expect(
      page.evaluate(
        ({ id, imageFile }) =>
          window.nightcode.invoke("session.send", {
            id,
            text: "Describe this image",
            providerId: "fixture",
            model: "fixture",
            mode: "Code",
            attachments: [
              { path: imageFile, name: "image.png", kind: "image" },
            ],
          }),
        { id: s.id, imageFile },
      ),
    ).rejects.toThrow("image support");
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Message NightCode" })
      .fill("Read hello.txt, update it, and run the test.");
    await page
      .getByRole("button", { name: "Send message · Enter", exact: true })
      .click();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.nightcode
              .invoke<any>("snapshot")
              .then((s) =>
                s.approvals.find(
                  (a: any) => a.kind === "edit" && a.status === "pending",
                ),
              ),
          ),
        { timeout: 60000 },
      )
      .toBeTruthy();
    expect(await fs.readFile(path.join(project, "hello.txt"), "utf8")).toBe(
      "original\n",
    );
    await page.screenshot({ path: "test-results/review-edit.png" });
    await expect(page.locator(".viewer")).toHaveCount(0);
    await expect(page.locator(".terminal-panel")).toHaveCount(0);
    await page.getByRole("button", { name: /Review file change/ }).click();
    await page
      .getByRole("button", { name: "Accept change", exact: true })
      .click();
    await expect
      .poll(() => fs.readFile(path.join(project, "hello.txt"), "utf8"))
      .toBe("reviewed\n");
    await expect(
      page.getByRole("button", { name: /Review command/ }),
    ).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /Review command/ }).click();
    await expect(
      page.getByRole("heading", { name: "Run this command?" }),
    ).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Approve once" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.nightcode
            .invoke<any>("snapshot")
            .then((s) =>
              s.commands.find(
                (c: any) =>
                  c.stdout.includes("nightcode-test-ok") && !c.running,
              ),
            ),
        ),
      )
      .toBeTruthy();
    expect(toolNames).toContain("nightcode_propose_edit");
    expect(toolNames).not.toContain("bash");
    expect(toolNames).not.toContain("edit");
    await expect(page.locator(".terminal-panel")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Toggle terminal", exact: true })
      .click();
    await page.screenshot({ path: "test-results/command-result.png" });
    await expect(
      page.getByText("Completed the reviewed change and test.", {
        exact: true,
      }),
    ).toBeVisible();
  } catch (e) {
    console.log(
      JSON.stringify(
        requests.flatMap(
          (r) => r.messages?.filter((m: any) => m.role === "tool") || [],
        ),
        null,
        2,
      ),
    );
    console.log(
      "Fixture requests:",
      requests.map((r) => ({
        model: r.model,
        tools: r.tools?.map((t: any) => t.function.name),
        messages: r.messages?.map((m: any) => ({
          role: m.role,
          content: m.role === "tool" ? m.content : undefined,
        })),
      })),
    );
    throw e;
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
