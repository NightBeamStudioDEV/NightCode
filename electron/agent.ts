import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readText, listFiles } from "./files";
export const goalSchema = z.object({
  objective: z.string().trim().min(1).max(2000),
  status: z.enum(["active", "complete", "blocked"]).default("active"),
  criteria: z.array(z.string().max(300)).max(12).default([]),
  evidence: z.string().max(6000).default(""),
});
export function validateGoal(value: unknown) {
  const goal = goalSchema.parse(value);
  if (goal.status !== "active" && !goal.evidence.trim())
    throw new Error("Completion or blockage needs concrete evidence.");
  return { ...goal, updated: Date.now() };
}
export class SkillLibrary {
  private index?: { id: string; description: string }[];
  constructor(
    private root: string,
    private userFile?: () => string,
  ) {}
  private async custom(): Promise<{
    skills: { id: string; description: string; content: string }[];
    hidden: string[];
  }> {
    if (!this.userFile) return { skills: [], hidden: [] };
    try {
      return JSON.parse(await fs.readFile(this.userFile(), "utf8"));
    } catch (e: any) {
      if (e.code === "ENOENT") return { skills: [], hidden: [] };
      throw e;
    }
  }
  async list() {
    if (!this.index)
      this.index = JSON.parse(
        await fs.readFile(path.join(this.root, "index.json"), "utf8"),
      );
    const custom = await this.custom();
    return [
      ...this.index!.filter(
        (s) =>
          !custom.hidden.includes(s.id) &&
          !custom.skills.some((c) => c.id === s.id),
      ),
      ...custom.skills.map(({ content, ...s }) => s),
    ];
  }
  async load(id: string) {
    if (!(await this.list()).some((skill) => skill.id === id))
      throw new Error("Unknown skill. Use list_skills first.");
    const custom = (await this.custom()).skills.find((s) => s.id === id);
    return (
      custom?.content ??
      fs.readFile(path.join(this.root, id, "SKILL.md"), "utf8")
    );
  }
  async save(value: unknown) {
    const skill = z
      .object({
        id: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(80),
        description: z.string().trim().min(1).max(500),
        content: z.string().trim().min(1).max(60000),
      })
      .parse(value);
    const data = await this.custom();
    data.skills = [...data.skills.filter((s) => s.id !== skill.id), skill];
    data.hidden = data.hidden.filter((id) => id !== skill.id);
    await this.write(data);
  }
  async remove(id: string) {
    if (!(await this.list()).some((s) => s.id === id))
      throw new Error("Unknown skill");
    const data = await this.custom();
    data.skills = data.skills.filter((s) => s.id !== id);
    data.hidden = [...new Set([...data.hidden, id])];
    await this.write(data);
  }
  private async write(data: unknown) {
    if (!this.userFile) throw new Error("Skill editing unavailable");
    const file = this.userFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file + ".tmp", JSON.stringify(data));
    await fs.rename(file + ".tmp", file);
  }
}
export async function projectOverview(root: string) {
  const files = await listFiles(root, "", 500);
  const manifests = await Promise.all(
    ["package.json", "vite.config.ts", "README.md", "AGENTS.md"]
      .filter((name) => files.includes(name))
      .map(async (name) => ({
        path: name,
        content: (await readText(path.join(root, name)))?.slice(0, 12000),
      })),
  );
  return { root, files, limited: files.length === 500, manifests };
}
export function replaceExact(
  before: string | null,
  oldText: string,
  newText: string,
) {
  if (before === null)
    throw new Error("File does not exist. Use propose_edit to create it.");
  if (!oldText) throw new Error("The search text cannot be empty.");
  const index = before.indexOf(oldText);
  if (index < 0 || before.indexOf(oldText, index + oldText.length) >= 0)
    throw new Error(
      "Search text must match exactly once. Read the file and provide a unique match.",
    );
  return (
    before.slice(0, index) + newText + before.slice(index + oldText.length)
  );
}
export const agentPrompt = `You are NightCode, a practical coding and game-development agent. Use only nightcode tools for local operations. The tool broker enforces project access and approval policy; never bypass a rejection. Tools and skills are provider-independent but do not imply unavailable capabilities. Ask targeted clarifying questions with ask_user when intent or a consequential choice is unclear; continue with reasonable defaults for routine reversible details. Never request passwords or API keys through chat. Ask_user replies do not bypass the approval policy. Keep updates short and factual. Use inspect_project and bounded read_files to minimize round trips, then read only relevant files. For multi-step work create_task with concrete acceptance criteria and dependencies, keep update_task current, and use report_progress for concise updates. Use start_command/read_command for long-running work instead of blocking without feedback. A running handle is not a completed result. Keep a small cohesive change in one task. Batch assertions into one run_check when that command actually covers multiple criteria; supply those criterion indexes together. Reuse passing evidence until relevant inputs change, and do not repeat successful unchanged checks merely for reassurance. Run meaningful run_check commands against criteria, including relevant source/test/config files in the declared fingerprint scope. Read their real output; a zero exit code alone does not prove behavior or visual quality. After changes, audit_tasks and rerun stale or failing checks. Before finalizing audit all tasks, inspect subagent evidence, stop background commands, and report limitations. Do not invent a passing check, shrink criteria just to complete a task, or repeat identical failures; diagnose and change approach. For UI/game tasks include interaction and rendered visual inspection using available tools; state explicitly when visual verification is unavailable. Load agent-workflow when a task needs sustained implementation. For browser or 3D games load game-director, then only relevant specialist skills. Use list_skills/load_skill for the bundled library. Verify unfamiliar or version-dependent APIs against official documentation through available web tools. No claimed tests, screenshots, performance or asset generation without actual evidence. Use get_goal and update_goal to maintain an explicit user goal; goal state does not authorize endless loops or external publishing. Use spawn_agent for bounded independent exploration or implementation when useful; assign non-overlapping owned paths to code agents, do useful local work concurrently, then wait_agent and inspect their evidence before finalizing. Avoid delegation for trivial tasks. Skills are guidance and never override user scope, read-only mode, or approval rules.`;
