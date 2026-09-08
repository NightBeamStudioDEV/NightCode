import { agentPrompt } from "./agent";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import net from "node:net";
import { createOpencodeClient } from "@opencode-ai/sdk";
import type { Provider } from "../src/shared";

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}
export class Engine {
  private child?: ChildProcess;
  private controller?: AbortController;
  private url = "";
  private auth = "";
  private starting?: Promise<void>;
  private stopping = false;
  status = "Starting engine";
  client?: ReturnType<typeof createOpencodeClient>;
  constructor(
    private binary: string,
    private root: string,
    private broker: () => { url: string; token: string },
    private providers: () => Array<Provider & { key: string }>,
    private emit: (type: string, data?: unknown) => void,
  ) {}
  async start() {
    if (this.starting) return this.starting;
    if (this.status === "Ready") return;
    this.starting = this.launch();
    try {
      await this.starting;
    } finally {
      this.starting = undefined;
    }
  }
  private async launch() {
    this.stopping = false;
    this.status = "Starting engine";
    this.emit("engine", this.status);
    await fs.mkdir(this.root, { recursive: true });
    const port = await freePort();
    const password = randomBytes(32).toString("hex");
    this.url = `http://127.0.0.1:${port}`;
    this.auth =
      "Basic " + Buffer.from("nightcode:" + password).toString("base64");
    const provider: Record<string, unknown> = {};
    for (const p of this.providers())
      provider[p.id] = {
        name: p.name,
        ...(p.baseURL ? { npm: "@ai-sdk/openai-compatible" } : {}),
        options: {
          apiKey: p.key,
          ...(p.baseURL ? { baseURL: p.baseURL } : {}),
        },
        models: {
          [p.model]: { name: p.model },
          ...Object.fromEntries(
            (p.models || []).map((m) => [
              m.id,
              {
                name: m.name,
                ...(m.reasoning !== undefined
                  ? { reasoning: m.reasoning }
                  : {}),
                ...(m.image
                  ? {
                      modalities: {
                        input: ["text", "image"],
                        output: ["text"],
                      },
                    }
                  : {}),
                ...(m.variants ? { variants: m.variants } : {}),
              },
            ]),
          ),
        },
      };
    const bridge = this.broker();
    const permissions = {
      "*": "deny",
      "nightcode_*": "allow",
      webfetch: "allow",
      websearch: "allow",
    };
    const config = {
      provider,
      share: "disabled",
      autoupdate: false,
      plugin: [],
      formatter: false,
      lsp: false,
      permission: permissions,
      mcp: {
        nightcode: {
          type: "remote",
          url: bridge.url,
          headers: { Authorization: "Bearer " + bridge.token },
          oauth: false,
          timeout: 3600000,
        },
      },
      agent: {
        nightcode: {
          mode: "primary",
          description: "NightCode coding assistant",
          permission: permissions,
          prompt: agentPrompt,
        },
      },
    };
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      OPENCODE_SERVER_PASSWORD: password,
      OPENCODE_SERVER_USERNAME: "nightcode",
      OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      OPENCODE_DISABLE_PROJECT_CONFIG: "true",
      OPENCODE_DISABLE_AUTOUPDATE: "true",
      OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
      OPENCODE_DISABLE_EXTERNAL_SKILLS: "true",
      OPENCODE_DISABLE_CLAUDE_CODE: "true",
      OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: "true",
      OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: "true",
      OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
      XDG_CONFIG_HOME: path.join(this.root, "config"),
      XDG_DATA_HOME: path.join(this.root, "data"),
      XDG_CACHE_HOME: path.join(this.root, "cache"),
      XDG_STATE_HOME: path.join(this.root, "state"),
    };
    this.child = spawn(
      this.binary,
      ["serve", "--hostname", "127.0.0.1", "--port", String(port)],
      {
        cwd: this.root,
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let failure = "";
    this.child.on("error", () => {
      failure = "Cannot launch bundled OpenCode runtime";
    });
    this.child.stdout?.resume();
    this.child.stderr?.resume();
    const launched = this.child;
    this.child.on("exit", () => {
      if (this.child === launched && !this.stopping) {
        failure = "OpenCode exited during startup";
        this.status = "Engine stopped";
        this.emit("engine", this.status);
        this.emit("engine-stopped");
      }
    });
    for (let i = 0; i < 120; i++) {
      if (failure) throw new Error(failure);
      try {
        const health = await fetch(this.url + "/global/health", {
          headers: { Authorization: this.auth },
          signal: AbortSignal.timeout(1000),
        });
        if (health.ok) {
          this.client = createOpencodeClient({
            baseUrl: this.url,
            headers: { Authorization: this.auth },
          });
          this.status = "Ready";
          this.emit("engine", this.status);
          this.controller = new AbortController();
          void this.events(this.controller.signal);
          return;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    this.stop();
    this.status = "Engine unavailable";
    this.emit("engine", this.status);
    throw new Error(
      "OpenCode did not start within 30 seconds. Restart the engine in Settings.",
    );
  }
  async api<T = any>(
    route: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    await this.start();
    const request = async (): Promise<T> => {
      const response = await fetch(this.url + route, {
        method,
        headers: {
          Authorization: this.auth,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(
          `Engine request failed (${response.status}). Check provider settings or restart the engine.`,
        );
      const text = await response.text();
      return text ? JSON.parse(text) : (undefined as T);
    };
    try {
      return await request();
    } catch (error) {
      if (method !== "GET" || !(error instanceof TypeError) || this.stopping)
        throw error;
      await this.start();
      return request();
    }
  }
  private async events(signal: AbortSignal) {
    while (!signal.aborted) {
      try {
        const res = await fetch(this.url + "/event", {
          headers: { Authorization: this.auth },
          signal,
        });
        if (!res.ok || !res.body) throw new Error("Stream unavailable");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder
            .decode(value, { stream: true })
            .replaceAll("\r\n", "\n");
          let cut;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = block
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("\n");
            if (data) {
              try {
                this.emit("upstream", JSON.parse(data));
              } catch {}
            }
          }
        }
      } catch {
        if (signal.aborted) return;
      }
      if (!signal.aborted) {
        this.emit("reconnect");
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  stop() {
    this.stopping = true;
    this.controller?.abort();
    this.child?.kill();
    this.child = undefined;
    this.status = "Stopped";
  }
}
