import fs from "node:fs/promises";
import crypto from "node:crypto";
import { z } from "zod";
import type { WorkTask, WorkCheck } from "../src/shared";

// Keep the full evidence in storage/UI; avoid replaying it on every tool call.
export function taskToolView(task: WorkTask) {
  return {
    ...task,
    checkDetails:
      "Use read_command with a check's commandId for its command and output.",
    checks: task.checks.map(({ command, output, inputs, ...check }, index) => ({
      ...check,
      files: Object.keys(inputs),
      ...(index === task.checks.length - 1 ? { output } : {}),
    })),
  };
}

export async function fingerprint(files: string[]) {
  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile() || stat.size > 8 * 1024 * 1024)
          throw new Error("Check inputs must be files up to 8 MB each");
        return [
          file,
          crypto
            .createHash("sha256")
            .update(await fs.readFile(file))
            .digest("hex"),
        ] as const;
      } catch (e: any) {
        if (e.code === "ENOENT") return [file, "missing"] as const;
        throw e;
      }
    }),
  );
  return Object.fromEntries(entries);
}
export class WorkLedger {
  constructor(
    private read: () => WorkTask[],
    private write: (tasks: WorkTask[]) => void,
    private allowed: (
      sessionId: string,
      file: string,
    ) => Promise<boolean> = async () => true,
  ) {}
  list(sessionId: string) {
    return structuredClone(
      this.read().filter((t) => t.sessionId === sessionId),
    );
  }
  get(sessionId: string, id: string) {
    const task = this.list(sessionId).find((t) => t.id === id);
    if (!task) throw new Error("Unknown task for this conversation");
    return task;
  }
  commandEvidence(sessionId: string, commandId: string) {
    const check = this.list(sessionId)
      .flatMap((task) => task.checks)
      .find((entry) => entry.commandId === commandId);
    if (!check) return undefined;
    return {
      id: commandId,
      command: check.command,
      running: false,
      archived: true,
      stdout: check.output,
      stderr: "",
      exitCode: check.exitCode,
      timedOut: check.timedOut,
      durationMs: check.durationMs,
      checkId: check.id,
      passed: check.passed,
      stale: check.stale,
      inputs: check.inputs,
      note: "The recent command record expired. This is retained check evidence: combined stdout/stderr, limited to the last 12000 characters.",
    };
  }
  private put(task: WorkTask) {
    this.write([...this.read().filter((t) => t.id !== task.id), task]);
    return task;
  }
  create(sessionId: string, input: unknown) {
    const data = z
      .object({
        title: z.string().trim().min(1).max(160),
        criteria: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
        dependsOn: z.array(z.string()).max(12).default([]),
      })
      .parse(input);
    if (this.list(sessionId).length >= 40)
      throw new Error(
        "Keep a focused task list: 40 tasks per conversation maximum",
      );
    for (const id of data.dependsOn) this.get(sessionId, id);
    return this.put({
      ...data,
      id: crypto.randomUUID(),
      sessionId,
      revision: 1,
      status: "pending",
      assessment: "",
      checks: [],
      updated: Date.now(),
    });
  }
  async audit(sessionId: string) {
    const hashes = new Map<string, Promise<string | undefined>>();
    const hash = (file: string) => {
      if (!hashes.has(file))
        hashes.set(
          file,
          (async () => {
            try {
              return (await this.allowed(sessionId, file))
                ? (await fingerprint([file]))[file]
                : undefined;
            } catch {
              return undefined;
            }
          })(),
        );
      return hashes.get(file)!;
    };
    for (const task of this.list(sessionId)) {
      for (const check of task.checks) {
        try {
          check.stale = !(
            await Promise.all(
              Object.entries(check.inputs).map(
                async ([file, previous]) => (await hash(file)) === previous,
              ),
            )
          ).every(Boolean);
        } catch {
          check.stale = true;
        }
      }
      const current = this.get(sessionId, task.id);
      const previousState = JSON.stringify(current);
      current.checks = current.checks.map((check) => ({
        ...check,
        stale:
          task.checks.find((old) => old.id === check.id)?.stale ?? check.stale,
      }));
      if (current.status === "complete" && this.missing(current).length)
        current.status = "review";
      if (JSON.stringify(current) !== previousState) this.put(current);
    }
    for (let pass = 0; pass < this.list(sessionId).length; pass++) {
      let changed = false;
      for (const task of this.list(sessionId))
        if (
          task.status === "complete" &&
          task.dependsOn.some(
            (id) => this.get(sessionId, id).status !== "complete",
          )
        ) {
          task.status = "review";
          this.put(task);
          changed = true;
        }
      if (!changed) break;
    }
    return this.list(sessionId).map((task) => ({
      ...task,
      missingCriteria: this.missing(task),
    }));
  }
  interrupt(sessionId?: string) {
    if (!this.read().some((task) => task.status === "running")) return;
    this.write(
      this.read().map((task) =>
        task.status === "running" &&
        (!sessionId || task.sessionId === sessionId)
          ? {
              ...task,
              status: "review",
              assessment:
                "Run ended before this task was completed. Inspect the current state before continuing.",
              updated: Date.now(),
            }
          : task,
      ),
    );
  }
  missing(task: WorkTask) {
    return task.criteria
      .map((_, i) => i)
      .filter((i) => {
        const latest = [...task.checks]
          .reverse()
          .find((c) => c.revision === task.revision && c.criteria.includes(i));
        return !latest?.passed || latest.stale;
      });
  }
  addCheck(sessionId: string, id: string, check: WorkCheck) {
    const task = this.get(sessionId, id);
    if (task.revision !== check.revision)
      throw new Error(
        "Task changed while the check ran; rerun for the new criteria",
      );
    task.checks = [...task.checks, check].slice(-30);
    if (!check.passed && task.status === "complete") task.status = "review";
    task.updated = Date.now();
    return this.put(task);
  }
  async update(sessionId: string, input: unknown) {
    const data = z
      .object({
        id: z.string(),
        status: z.enum(["pending", "running", "blocked", "review", "complete"]),
        title: z.string().trim().min(1).max(160).optional(),
        criteria: z
          .array(z.string().trim().min(1).max(500))
          .min(1)
          .max(12)
          .optional(),
        assessment: z.string().trim().min(1).max(6000),
      })
      .parse(input);
    await this.audit(sessionId);
    const task = this.get(sessionId, data.id);
    if (
      data.criteria &&
      JSON.stringify(data.criteria) !== JSON.stringify(task.criteria)
    ) {
      task.criteria = data.criteria;
      task.revision++;
    }
    if (data.status === "complete" || data.status === "running") {
      if (
        task.dependsOn.some(
          (id) => this.get(sessionId, id).status !== "complete",
        )
      )
        throw new Error("Finish this task's dependencies first");
    }
    if (data.status === "complete" && this.missing(task).length)
      throw new Error(
        "Completion needs a passing, current check for every criterion. Run checks and assess their actual coverage first.",
      );
    return this.put({
      ...task,
      title: data.title || task.title,
      status: data.status,
      assessment: data.assessment,
      updated: Date.now(),
    });
  }
}
