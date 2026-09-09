import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BotLibrary } from "../electron/bots";
function setup() {
  const values = new Map<string, any>();
  const store = {
    get: (key: string, fallback: any) =>
      structuredClone(values.get(key) ?? fallback),
    set: (key: string, value: any) => values.set(key, structuredClone(value)),
  };
  return { store, bots: new BotLibrary(store as any, () => {}) };
}
describe("NightBots scheduler", () => {
  it("defers busy runs, catches up once, and advances recurring work without floods", async () => {
    const { bots } = setup();
    const bot = bots.save({
      name: "Research",
      instructions: "Cite sources",
      providerId: "local",
      model: "test",
    });
    bots.saveJob({
      botId: bot.id,
      name: "Review",
      prompt: "Check the task",
      kind: "interval",
      nextRun: 10,
      intervalMinutes: 1,
    });
    const run = vi.fn(async () => ({ id: "session" }));
    await bots.tick(120000, () => true, run);
    expect(run).not.toHaveBeenCalled();
    await bots.tick(120000, () => false, run);
    await bots.tick(120000, () => false, run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(bots.jobs()[0].nextRun).toBe(180000);
    expect(bots.jobs()[0].lastSessionId).toBe("session");
  });
  it("fires file triggers only on changes, pauses errors, and deletes associated jobs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bots-test-"));
    const file = path.join(root, "watch.txt");
    await fs.writeFile(file, "one");
    const { bots } = setup(),
      bot = bots.save({
        name: "Watch",
        instructions: "Review changes",
        providerId: "local",
        model: "test",
      });
    bots.saveJob({
      botId: bot.id,
      name: "Watch",
      prompt: "Review",
      kind: "file",
      watchPath: file,
      nextRun: 0,
      intervalMinutes: 1,
    });
    const run = vi.fn(async () => ({ id: "session" }));
    await bots.tick(0, () => false, run);
    expect(run).not.toHaveBeenCalled();
    await fs.writeFile(file, "two");
    await bots.tick(60000, () => false, run);
    expect(run).toHaveBeenCalledTimes(1);
    await fs.unlink(file);
    await bots.tick(120000, () => false, run);
    expect(bots.jobs()[0].enabled).toBe(false);
    expect(bots.jobs()[0].error).toBeTruthy();
    bots.remove(bot.id);
    expect(bots.jobs()).toEqual([]);
    await fs.rmdir(root);
  });
  it("does not resurrect a job deleted while a run starts", async () => {
    const { bots } = setup(),
      bot = bots.save({
        name: "Once",
        instructions: "Review",
        providerId: "local",
        model: "test",
      });
    const job = bots.saveJob({
      botId: bot.id,
      name: "Once",
      prompt: "Review",
      kind: "once",
      nextRun: 0,
    });
    await bots.tick(
      1,
      () => false,
      async () => {
        bots.removeJob(job.id);
        return { id: "s" };
      },
    );
    expect(bots.jobs()).toEqual([]);
  });
});
