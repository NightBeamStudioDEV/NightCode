import { Engine } from "./engine";
import { Broker } from "./broker";
import type { Provider, Subagent } from "../src/shared";
import path from "node:path";
import crypto from "node:crypto";

type Child = {
  view: Subagent;
  engine: Engine;
  broker: Broker;
  session?: string;
  messages: any[];
  timer?: NodeJS.Timeout;
  fetching?: Promise<void>;
  pending: boolean;
  completing?: boolean;
  settled: Promise<void>;
  finish: () => void;
};
export class Subagents {
  private children = new Map<string, Child>();
  constructor(
    private binary: string,
    private root: string,
    private providers: () => Array<Provider & { key: string }>,
    private changed: () => void,
    private cancelled: (id: string) => void = () => {},
  ) {}
  list() {
    return [...this.children.values()].map((c) => ({ ...c.view }));
  }
  progress(id: string, label: string) {
    const c = this.children.get(id);
    if (c && this.alive(id)) {
      c.view.progress = label;
      this.changed();
    }
  }
  async spawn(
    parentId: string,
    title: string,
    role: "explore" | "code",
    prompt: string,
    model: { providerID: string; modelID: string },
    call: (name: string, input: unknown) => Promise<unknown>,
    context: Pick<
      Subagent,
      "projectName" | "projectPath" | "branch" | "paths"
    > = {},
  ) {
    if (
      this.list().filter((c) => ["starting", "running"].includes(c.status))
        .length >= 4
    )
      throw new Error(
        "Four subagents are already working. Wait for one to finish.",
      );
    if (this.list().filter((c) => c.parentId === parentId).length >= 12)
      throw new Error(
        "This task has reached its 12-agent limit. Continue locally.",
      );
    const id = crypto.randomUUID();
    const broker = new Broker(
      (name, input) => {
        if (!this.alive(id)) throw new Error("Subagent stopped");
        return call(name, input);
      },
      () => this.stop(id),
    );
    let finish!: () => void;
    const child: Child = {
      view: { id, parentId, title, role, status: "starting", ...context },
      broker,
      engine: undefined!,
      messages: [],
      pending: false,
      settled: new Promise((r) => {
        finish = r;
      }),
      finish: () => finish(),
    };
    child.engine = new Engine(
      this.binary,
      path.join(this.root, id),
      () => ({ url: broker.url, token: broker.token }),
      this.providers,
      (type, data: any) => {
        if (!this.alive(id)) return;
        if (type === "upstream") {
          const prop = data.properties || {};
          this.schedule(child);
          if (prop.sessionID === child.session && data.type === "session.error")
            void this.complete(
              child,
              "error",
              prop.error?.data?.message || "Provider request failed",
            );
          if (
            prop.sessionID === child.session &&
            (data.type === "session.idle" ||
              (data.type === "session.status" &&
                prop.status?.type === "idle")) &&
            child.view.status === "running"
          )
            void this.complete(child, "complete");
        } else if (type === "engine-stopped")
          void this.complete(child, "error", "Subagent engine stopped");
      },
    );
    this.children.set(id, child);
    this.changed();
    void (async () => {
      try {
        await broker.start();
        if (!this.alive(id)) {
          broker.stop();
          return;
        }
        const session = await child.engine.api("/session", "POST", { title });
        child.session = session.id;
        if (!this.alive(id)) {
          child.engine.stop();
          return;
        }
        child.view.status = "running";
        this.changed();
        await child.engine.api(`/session/${session.id}/prompt_async`, "POST", {
          agent: "nightcode",
          model,
          system:
            "You are a delegated NightCode subagent. Stay within the assigned task. You are sharing the project: do not revert others’ work. No further delegation. Summarize findings, changed files and verification evidence. Parent runs commands and owns the final response.",
          parts: [{ type: "text", text: prompt }],
        });
      } catch (e: any) {
        await this.complete(child, "error", e.message);
      }
    })();
    return { ...child.view };
  }
  alive(id: string) {
    const status = this.children.get(id)?.view.status;
    return status === "starting" || status === "running";
  }
  private schedule(c: Child) {
    if (c.timer) return;
    c.timer = setTimeout(() => {
      c.timer = undefined;
      void this.refresh(c).catch(() => {});
    }, 150);
  }
  private async refresh(c: Child) {
    if (!c.session) return;
    if (c.fetching) {
      c.pending = true;
      return c.fetching;
    }
    c.fetching = (async () => {
      do {
        c.pending = false;
        c.messages = await c.engine.api(`/session/${c.session}/message`);
        this.changed();
      } while (c.pending && this.alive(c.view.id));
    })();
    try {
      await c.fetching;
    } finally {
      c.fetching = undefined;
    }
  }
  private async complete(
    c: Child,
    status: "complete" | "error",
    error?: string,
  ) {
    if (!this.alive(c.view.id) || c.completing) return;
    c.completing = true;
    if (c.timer) clearTimeout(c.timer);
    try {
      await this.refresh(c);
    } catch {}
    if (!this.alive(c.view.id)) return;
    c.view.status = status;
    this.cancelled(c.view.id);
    c.view.result =
      error ||
      c.messages
        .filter((m) => m.info?.role === "assistant")
        .flatMap((m) => m.parts || [])
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .slice(-24000) ||
      "Finished without a text summary. Inspect the activity for details.";
    c.engine.stop();
    c.broker.stop();
    c.finish();
    this.changed();
  }
  messages(id: string) {
    const c = this.children.get(id);
    if (!c) throw new Error("Unknown subagent");
    return c.messages;
  }
  async wait(id: string, parentId: string) {
    const c = this.children.get(id);
    if (!c || c.view.parentId !== parentId)
      throw new Error("Unknown subagent for this task");
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      c.settled,
      new Promise<void>((r) => {
        timer = setTimeout(r, 20000);
      }),
    ]);
    if (timer) clearTimeout(timer);
    return { ...c.view };
  }
  stop(id: string) {
    const c = this.children.get(id);
    if (!c || !this.alive(id)) return;
    c.view.status = "stopped";
    this.cancelled(id);
    if (c.timer) clearTimeout(c.timer);
    c.engine.stop();
    c.broker.stop();
    c.finish();
    this.changed();
  }
  stopAll(parentId?: string) {
    for (const [id, child] of this.children)
      if (!parentId || child.view.parentId === parentId) this.stop(id);
  }
}
