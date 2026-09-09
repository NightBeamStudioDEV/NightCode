import crypto from "node:crypto";
import fs from "node:fs/promises";
import { z } from "zod";
import type { Store } from "./store";
export const botSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(240).default(""),
  instructions: z.string().trim().min(1).max(12000),
  projectId: z.string().default(""),
  providerId: z.string().min(1),
  model: z.string().min(1),
  color: z.enum(["blue", "violet", "emerald", "rose"]).default("violet"),
});
export type NightBot = z.infer<typeof botSchema> & {
  id: string;
  created: number;
};
export type BotJob = {
  id: string;
  botId: string;
  name: string;
  prompt: string;
  kind: "once" | "interval" | "file";
  enabled: boolean;
  nextRun: number;
  intervalMinutes: number;
  watchPath: string;
  fingerprint?: string;
  lastRun?: number;
  lastSessionId?: string;
  error?: string;
};
export const jobSchema = z.object({
  id: z.string().optional(),
  botId: z.string(),
  name: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(12000),
  kind: z.enum(["once", "interval", "file"]),
  enabled: z.boolean().default(true),
  nextRun: z.number().finite().default(Date.now),
  intervalMinutes: z.number().int().min(1).max(525600).default(60),
  watchPath: z.string().max(2048).default(""),
});
export class BotLibrary {
  private ticking = false;
  constructor(
    private store: Store,
    private changed: () => void,
  ) {}
  list() {
    return this.store.get<NightBot[]>("bots", []);
  }
  get(id: string) {
    const b = this.list().find((b) => b.id === id);
    if (!b) throw new Error("Unknown bot");
    return b;
  }
  save(input: unknown) {
    const data = botSchema.parse(input),
      old = data.id ? this.get(data.id) : undefined;
    const bot = {
      ...data,
      id: old?.id || crypto.randomUUID(),
      created: old?.created || Date.now(),
    };
    this.store.set("bots", [
      ...this.list().filter((b) => b.id !== bot.id),
      bot,
    ]);
    this.changed();
    return bot;
  }
  remove(id: string) {
    this.get(id);
    this.store.set(
      "bots",
      this.list().filter((b) => b.id !== id),
    );
    this.store.set(
      "botJobs",
      this.jobs().filter((j) => j.botId !== id),
    );
    this.store.set(
      "memories",
      this.store
        .get<any[]>("memories", [])
        .filter((m) => m.scope !== "bot:" + id),
    );
    this.changed();
  }
  jobs() {
    return this.store.get<BotJob[]>("botJobs", []);
  }
  saveJob(input: unknown) {
    const data = jobSchema.parse(input);
    this.get(data.botId);
    const old = data.id ? this.jobs().find((j) => j.id === data.id) : undefined;
    if (data.id && !old) throw new Error("Unknown schedule");
    if (data.kind === "file" && !data.watchPath)
      throw new Error("Choose a file to watch");
    const job: BotJob = {
      ...old,
      ...data,
      id: old?.id || crypto.randomUUID(),
      fingerprint:
        old?.watchPath === data.watchPath ? old?.fingerprint : undefined,
    };
    this.store.set("botJobs", [
      ...this.jobs().filter((j) => j.id !== job.id),
      job,
    ]);
    this.changed();
    return job;
  }
  removeJob(id: string) {
    this.store.set(
      "botJobs",
      this.jobs().filter((j) => j.id !== id),
    );
    this.changed();
  }
  async tick(
    now: number,
    busy: () => boolean,
    run: (botId: string, prompt: string) => Promise<{ id: string }>,
  ) {
    if (this.ticking || busy()) return;
    this.ticking = true;
    try {
      for (const original of this.jobs()) {
        if (busy()) break;
        if (!original.enabled || original.nextRun > now) continue;
        const job = { ...original };
        let fire = true;
        try {
          if (job.kind === "file") {
            const stat = await fs.stat(job.watchPath);
            if (!stat.isFile() || stat.size > 10 * 1024 * 1024)
              throw new Error("Watch an existing file smaller than 10 MB");
            const hash = crypto
              .createHash("sha256")
              .update(await fs.readFile(job.watchPath))
              .digest("hex");
            fire = !!job.fingerprint && job.fingerprint !== hash;
            job.fingerprint = hash;
          }
          if (fire) {
            const result = await run(job.botId, job.prompt);
            job.lastRun = now;
            job.lastSessionId = result.id;
            job.error = undefined;
            if (job.kind === "once") job.enabled = false;
          }
        } catch (e: any) {
          job.error = e.message;
          job.enabled = false;
        }
        job.nextRun = now + job.intervalMinutes * 60000;
        // The user may edit or delete a schedule while its asynchronous run starts.
        this.store.set(
          "botJobs",
          this.jobs().map((j) =>
            j.id === job.id && JSON.stringify(j) === JSON.stringify(original)
              ? job
              : j,
          ),
        );
        this.changed();
      }
    } finally {
      this.ticking = false;
    }
  }
}
