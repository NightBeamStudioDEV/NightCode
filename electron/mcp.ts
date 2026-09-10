import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { z } from "zod";
export const mcpConfig = z
  .object({
    name: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(60),
    type: z.enum(["remote", "local"]),
    url: z.string().default(""),
    command: z.string().default(""),
    args: z.array(z.string()).max(80).default([]),
    headers: z.record(z.string()).default({}),
    environment: z.record(z.string()).default({}),
  })
  .superRefine((v, ctx) => {
    if (v.type === "remote") {
      try {
        const url = new URL(v.url);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Enter an HTTP or HTTPS MCP endpoint.",
        });
      }
    } else if (!v.command.trim())
      ctx.addIssue({ code: "custom", message: "Enter an executable." });
  });
export type McpConfig = z.infer<typeof mcpConfig>;
export class McpConnections {
  private clients = new Map<string, Promise<Client>>();
  constructor(private configs: () => McpConfig[]) {}
  async connect(name: string): Promise<Client> {
    const existing = this.clients.get(name);
    if (existing) return existing;
    const config = this.configs().find((c) => c.name === name);
    if (!config)
      throw new Error("Unknown MCP server. Add it in Settings → MCP servers.");
    const pending = (async () => {
      const transports =
        config.type === "local"
          ? [
              new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: {
                  ...Object.fromEntries(
                    Object.entries(process.env).filter(
                      (entry): entry is [string, string] =>
                        typeof entry[1] === "string",
                    ),
                  ),
                  ...config.environment,
                },
                stderr: "ignore",
              }),
            ]
          : [
              new StreamableHTTPClientTransport(new URL(config.url), {
                requestInit: { headers: config.headers },
              }),
              new SSEClientTransport(new URL(config.url), {
                requestInit: { headers: config.headers },
              }),
            ];
      let last: unknown;
      for (const transport of transports) {
        const client = new Client(
          { name: "nightcode", version: "0.4.0" },
          { capabilities: {} },
        );
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            client.connect(transport),
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("MCP connection timed out")),
                15000,
              );
            }),
          ]);
          client.onclose = () => {
            if (this.clients.get(name) === pending) this.clients.delete(name);
          };
          return client;
        } catch (error) {
          last = error;
          await client.close().catch(() => {});
        } finally {
          clearTimeout(timer);
        }
      }
      throw last;
    })();
    this.clients.set(name, pending);
    try {
      return await pending;
    } catch (error) {
      if (this.clients.get(name) === pending) this.clients.delete(name);
      throw error;
    }
  }
  async tools(name: string) {
    const client = await this.connect(name);
    const tools = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools({ cursor });
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor && tools.length < 1000);
    return tools;
  }
  async call(
    server: string,
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const client = await this.connect(server);
    return client.callTool({ name: tool, arguments: args }, undefined, {
      timeout: 120000,
      signal,
    });
  }
  async disconnect(name: string) {
    const client = this.clients.get(name);
    this.clients.delete(name);
    if (client) await client.then((c) => c.close()).catch(() => {});
  }
  async close() {
    await Promise.all(
      [...this.clients.keys()].map((name) => this.disconnect(name)),
    );
  }
}
