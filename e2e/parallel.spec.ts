import { test, expect, _electron as electron } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("parallel conversations keep tool context and cancellation isolated; attachments are paths", async () => {
  test.setTimeout(180000);
  const requests: any[] = [];
  const provider = http.createServer(async (req, res) => {
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
                message: { role: "assistant", content: "Test" },
                finish_reason: "stop",
              },
            ],
          }),
        );
      return;
    }
    const outputs = (body.messages || []).filter((m: any) => m.role === "tool");
    const name = (suffix: string) =>
      body.tools.find((t: any) => t.function.name.endsWith(suffix)).function
        .name;
    const calls: [string, object][] = [
      ["read_file", { path: "identity.txt" }],
      [
        "ask_user",
        { question: "Continue this task?", options: ["Continue", "Stop"] },
      ],
      ["mcp_list_tools", { server: "fixture" }],
      [
        "mcp_call_tool",
        { server: "fixture", tool: "echo", arguments: { text: "MCP works" } },
      ],
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
                name: name(call[0]),
                arguments: JSON.stringify(call[1]),
              },
            },
          ],
        }
      : { role: "assistant", content: "Parallel task completed." };
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: call ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  const mcpCalls: any[] = [];
  const mcp = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const rpc = JSON.parse(raw);
    mcpCalls.push(rpc);
    if (rpc.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    const result =
      rpc.method === "initialize"
        ? {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "fixture", version: "1" },
          }
        : rpc.method === "tools/list"
          ? {
              tools: [
                {
                  name: "echo",
                  description: "Echo text",
                  inputSchema: {
                    type: "object",
                    properties: { text: { type: "string" } },
                    required: ["text"],
                  },
                  annotations: { readOnlyHint: true },
                },
              ],
            }
          : {
              content: [
                { type: "text", text: rpc.params?.arguments?.text || "pong" },
              ],
            };
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
  });
  await Promise.all([
    new Promise<void>((r) => provider.listen(0, "127.0.0.1", r)),
    new Promise<void>((r) => mcp.listen(0, "127.0.0.1", r)),
  ]);
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-parallel-"));
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
    await page.evaluate(
      async ({ providerPort, mcpPort }) => {
        await window.nightcode.invoke("providers.save", {
          id: "fixture",
          name: "Fixture",
          model: "fixture",
          baseURL: `http://127.0.0.1:${providerPort}/v1`,
          key: "test",
          models: [
            {
              id: "fixture",
              name: "Fixture",
              reasoning: true,
              variants: { max: { reasoningEffort: "max" } },
            },
          ],
        });
        await window.nightcode.invoke("mcp.save", {
          name: "fixture",
          type: "remote",
          url: `http://127.0.0.1:${mcpPort}/mcp`,
        });
      },
      {
        providerPort: (provider.address() as any).port,
        mcpPort: (mcp.address() as any).port,
      },
    );
    const sessions: any[] = [];
    for (const label of ["ALPHA", "BETA"]) {
      const folder = path.join(data, label);
      await fs.mkdir(folder);
      await fs.writeFile(path.join(folder, "identity.txt"), label);
      await app.evaluate(({ dialog }, folder) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [folder],
        });
      }, folder);
      const session = await page.evaluate(async () => {
        const project = await window.nightcode.invoke<any>("projects.open");
        return window.nightcode.invoke<any>("session.create", {
          projectId: project.id,
        });
      });
      sessions.push(session);
    }
    const attached = path.join(data, "reference.png");
    await fs.writeFile(attached, "DO_NOT_INLINE_ATTACHMENT_CONTENT");
    await Promise.all(
      sessions.map((s, i) =>
        page.evaluate(
          ({ id, attached, i }) =>
            window.nightcode.invoke("session.send", {
              id,
              text: `Task ${i} @mcp:fixture @toolkit:code`,
              providerId: "fixture",
              model: "fixture",
              reasoning: "max",
              permissionMode: "full",
              mode: "Code",
              attachments: [
                { path: attached, name: "reference.png", kind: "image" },
              ],
            }),
          { id: s.id, attached, i },
        ),
      ),
    );
    await expect
      .poll(async () => (await snapshot()).questions?.length, {
        timeout: 60000,
      })
      .toBe(2);
    expect((await snapshot()).activeSessionIds).toHaveLength(2);
    const allRequests = JSON.stringify(requests);
    expect(allRequests).toContain("ALPHA");
    expect(allRequests).toContain("BETA");
    expect(allRequests).toContain("reference.png");
    expect(allRequests).not.toContain("DO_NOT_INLINE_ATTACHMENT_CONTENT");
    expect(allRequests).not.toContain("data:image");
    expect(requests.some((r) => r.reasoning_effort === "max")).toBeTruthy();
    await page.evaluate(
      (id) => window.nightcode.invoke("session.abort", { id }),
      sessions[0].id,
    );
    await expect
      .poll(async () => (await snapshot()).activeSessionIds)
      .toEqual([sessions[1].id]);
    const question = (await snapshot()).questions[0];
    expect(question.sessionId).toBe(sessions[1].id);
    await page.evaluate(
      (id) =>
        window.nightcode.invoke("question.reply", { id, answer: "Continue" }),
      question.id,
    );
    await expect
      .poll(() => mcpCalls.filter((c) => c.method === "tools/call").length, {
        timeout: 60000,
      })
      .toBe(1);
    await expect
      .poll(async () => (await snapshot()).activeSessionIds.length, {
        timeout: 60000,
      })
      .toBe(0);
    const messages = await page.evaluate(
      (id) => window.nightcode.invoke<any[]>("session.messages", { id }),
      sessions[1].id,
    );
    expect(JSON.stringify(messages)).toContain("MCP works");
    expect(JSON.stringify(messages)).toContain("BETA");
    expect(JSON.stringify(messages)).not.toContain("ALPHA");
  } finally {
    await app.close();
    provider.closeAllConnections();
    mcp.closeAllConnections();
    await Promise.all([
      new Promise<void>((r) => provider.close(() => r())),
      new Promise<void>((r) => mcp.close(() => r())),
    ]);
  }
});
