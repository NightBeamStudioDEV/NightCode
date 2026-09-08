import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  engines: [] as any[],
  brokers: [] as any[],
}));
vi.mock("../electron/engine", () => ({
  Engine: class {
    stop = vi.fn();
    api = vi.fn(async (route: string) =>
      route === "/session"
        ? { id: "child-session" }
        : route.endsWith("/message")
          ? [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "Verified result" }],
              },
            ]
          : undefined,
    );
    constructor(
      _binary: unknown,
      _root: unknown,
      _broker: unknown,
      _providers: unknown,
      public emit: any,
    ) {
      fixture.engines.push(this);
    }
  },
}));
vi.mock("../electron/broker", () => ({
  Broker: class {
    url = "local";
    token = "test";
    start = vi.fn(async () => {});
    stop = vi.fn();
    constructor(public call: any) {
      fixture.brokers.push(this);
    }
  },
}));
import { Subagents } from "../electron/subagents";
const model = { providerID: "test", modelID: "test" };
beforeEach(() => {
  fixture.engines.length = 0;
  fixture.brokers.length = 0;
});
it("uses independent tool callbacks and bounds concurrent work", async () => {
  const team = new Subagents(
    "engine",
    "root",
    () => [],
    () => {},
  );
  const one = await team.spawn(
    "parent",
    "First",
    "explore",
    "Inspect",
    model,
    async () => "one",
  );
  await team.spawn(
    "parent",
    "Second",
    "code",
    "Write",
    model,
    async () => "two",
  );
  expect(await fixture.brokers[0].call("read_file", {})).toBe("one");
  expect(await fixture.brokers[1].call("read_file", {})).toBe("two");
  await expect(
    team.spawn(
      "parent",
      "Third",
      "explore",
      "Inspect",
      model,
      async () => "three",
    ),
  ).rejects.toThrow(/Two subagents/);
  await expect(team.wait(one.id, "another-parent")).rejects.toThrow(/Unknown/);
  team.stopAll();
});
it("cancellation revokes tools, releases waiters, and reports the stopped owner", async () => {
  const cancelled = vi.fn();
  const team = new Subagents(
    "engine",
    "root",
    () => [],
    () => {},
    cancelled,
  );
  const child = await team.spawn(
    "parent",
    "First",
    "explore",
    "Inspect",
    model,
    async () => "result",
  );
  const waiting = team.wait(child.id, "parent");
  team.stop(child.id);
  expect((await waiting).status).toBe("stopped");
  expect(cancelled).toHaveBeenCalledWith(child.id);
  expect(() => fixture.brokers[0].call("read_file", {})).toThrow(/stopped/);
  expect(fixture.engines[0].stop).toHaveBeenCalled();
});
it("collects final evidence before releasing a completed agent", async () => {
  const team = new Subagents(
    "engine",
    "root",
    () => [],
    () => {},
  );
  const child = await team.spawn(
    "parent",
    "First",
    "explore",
    "Inspect",
    model,
    async () => "result",
  );
  await vi.waitFor(() => expect(team.list()[0].status).toBe("running"));
  fixture.engines[0].emit("upstream", {
    type: "session.idle",
    properties: { sessionID: "child-session" },
  });
  const result = await team.wait(child.id, "parent");
  expect(result).toMatchObject({
    status: "complete",
    result: "Verified result",
  });
  expect(team.messages(child.id)).toHaveLength(1);
  team.stopAll();
});
