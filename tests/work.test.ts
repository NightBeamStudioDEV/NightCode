import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkLedger, fingerprint, taskToolView } from "../electron/work";
import type { WorkTask, WorkCheck } from "../src/shared";
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-evidence-")),
    file = path.join(dir, "source.txt");
  await fs.writeFile(file, "one");
  let state: WorkTask[] = [];
  const ledger = new WorkLedger(
    () => state,
    (value) => {
      state = value;
    },
  );
  const task = ledger.create("session", {
    title: "Fix",
    criteria: ["Behavior works"],
  });
  const check = async (passed = true): Promise<WorkCheck> => ({
    id: String(Math.random()),
    revision: 1,
    criteria: [0],
    commandId: "real-command",
    command: "test",
    passed,
    stale: false,
    inputs: await fingerprint([file]),
    output: "result",
    timestamp: Date.now(),
  });
  return { ledger, task, file, check };
}
it("does not persist unchanged audits but persists stale evidence", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-noop-"));
  const file = path.join(dir, "input.txt");
  await fs.writeFile(file, "before");
  let state: WorkTask[] = [], writes = 0;
  const ledger = new WorkLedger(() => structuredClone(state), (next) => {
    state = next; writes++;
  });
  const task = ledger.create("s", { title: "Check", criteria: ["Works"] });
  ledger.addCheck("s", task.id, {
    id: "c", revision: 1, criteria: [0], commandId: "cmd", command: "test",
    passed: true, stale: false, inputs: await fingerprint([file]), output: "pass", timestamp: Date.now(),
  });
  writes = 0;
  await ledger.audit("s");
  ledger.interrupt();
  expect(writes).toBe(0);
  await fs.writeFile(file, "after");
  await ledger.audit("s");
  expect(writes).toBe(1);
  expect(ledger.get("s", task.id).checks[0].stale).toBe(true);
});
it("compacts model responses without discarding stored evidence or check coverage", async () => {
  const { ledger, task, check } = await fixture();
  ledger.addCheck("session", task.id, { ...await check(false), output: "earlier failure", command: "earlier command" });
  ledger.addCheck("session", task.id, { ...await check(true), output: "latest success" });
  const original = ledger.get("session", task.id);
  const view = taskToolView(original);
  expect(view.checks[0]).toMatchObject({ passed: false, criteria: [0], commandId: "real-command" });
  expect(view.checks[0]).not.toHaveProperty("output");
  expect(view.checks[0]).not.toHaveProperty("command");
  expect(view.checks[1].output).toBe("latest success");
  expect(view.checks[0].files).toEqual(Object.keys(original.checks[0].inputs));
  expect(ledger.get("session", task.id).checks[0].output).toBe("earlier failure");
  expect(original.checks[0].command).toBe("earlier command");
  expect(ledger.commandEvidence("session", "real-command")).toMatchObject({
    archived: true, running: false, stdout: "earlier failure", command: "earlier command",
  });
  expect(ledger.commandEvidence("other-session", "real-command")).toBeUndefined();
  expect(ledger.commandEvidence("session", "unknown-command")).toBeUndefined();
});
it("interrupted work returns to review instead of appearing active forever", async () => {
  const { ledger, task } = await fixture();
  await ledger.update("session", {
    id: task.id,
    status: "running",
    assessment: "Implementing",
  });
  ledger.interrupt();
  expect(ledger.get("session", task.id).status).toBe("review");
});
it("requires coverage and detects edits after completion", async () => {
  const { ledger, task, file, check } = await fixture();
  await expect(
    ledger.update("session", {
      id: task.id,
      status: "complete",
      assessment: "Claim",
    }),
  ).rejects.toThrow(/passing/);
  ledger.addCheck("session", task.id, await check());
  await ledger.update("session", {
    id: task.id,
    status: "complete",
    assessment: "Verified actual behavior",
  });
  await fs.writeFile(file, "two");
  expect((await ledger.audit("session"))[0]).toMatchObject({
    status: "review",
    missingCriteria: [0],
  });
});
it("a newer failing check supersedes an older success and changed criteria need new checks", async () => {
  const { ledger, task, check } = await fixture();
  ledger.addCheck("session", task.id, await check());
  ledger.addCheck("session", task.id, await check(false));
  await expect(
    ledger.update("session", {
      id: task.id,
      status: "complete",
      assessment: "Claim",
    }),
  ).rejects.toThrow(/passing/);
  ledger.addCheck("session", task.id, await check());
  const changed = await ledger.update("session", {
    id: task.id,
    status: "running",
    criteria: ["New behavior"],
    assessment: "Scope clarified",
  });
  expect(changed.revision).toBe(2);
  expect(ledger.missing(changed)).toEqual([0]);
});
it("blocks unmet dependencies and isolates sessions", async () => {
  const { ledger, task, check, file } = await fixture();
  const child = ledger.create("session", {
    title: "Follow up",
    criteria: ["Follow up works"],
    dependsOn: [task.id],
  });
  expect(() => ledger.get("other", task.id)).toThrow(/Unknown/);
  await expect(
    ledger.update("session", {
      id: child.id,
      status: "running",
      assessment: "Start",
    }),
  ).rejects.toThrow(/dependencies/);
  ledger.addCheck("session", task.id, await check());
  await ledger.update("session", {
    id: task.id,
    status: "complete",
    assessment: "Verified",
  });
  ledger.addCheck("session", child.id, await check());
  await ledger.update("session", {
    id: child.id,
    status: "complete",
    assessment: "Verified",
  });
  await fs.writeFile(file, "changed");
  expect(
    (await ledger.audit("session")).every((t) => t.status === "review"),
  ).toBe(true);
});
