import type { Message } from "./shared";
export type Part = Message["parts"][number];
export type FeedItem = {
  key: string;
  role: string;
  text?: string;
  tools?: Part[];
  reasoning?: boolean;
  streaming?: boolean;
};

// Engine turns may contain several assistant messages between two user prompts.
// Only visible prose breaks an activity group; metadata does not create whitespace.
export function buildFeed(messages: Message[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const message of messages) {
    message.parts.forEach((part, index) => {
      const key = `${message.id}:${index}`;
      if (part.type === "text" && part.text?.trim()) {
        items.push({ key, role: message.role, text: part.text });
      } else if (part.type === "reasoning" && part.text?.trim()) {
        items.push({
          key,
          role: message.role,
          text: part.text,
          reasoning: true,
          streaming: !part.time?.end,
        });
      } else if (part.type === "tool") {
        const previous = items.at(-1);
        if (previous?.tools && previous.role === message.role)
          previous.tools.push(part);
        else items.push({ key, role: message.role, tools: [part] });
      }
    });
  }
  return items;
}

export function toolInfo(part: Part) {
  const name = (part.tool || "action").replace(
    /^nightcode_(?:[a-f0-9]{10}_)?/,
    "",
  );
  const input = (part.state?.input || {}) as Record<string, unknown>;
  const failed = part.state?.status === "error";
  const active = !["completed", "error"].includes(part.state?.status || "");
  const kind = /_task|audit_tasks/.test(name)
    ? "task"
    : name === "run_check"
      ? "check"
      : /^(read|stop)_command$/.test(name)
        ? "monitor"
        : /(?:spawn|wait|list)_agent/.test(name)
          ? "agent"
          : /ask_user/.test(name)
            ? "question"
            : /skill/.test(name)
              ? "skill"
              : /goal/.test(name)
                ? "goal"
                : /inspect_project/.test(name)
                  ? "inspect"
                  : /edit|write|replace/.test(name)
                    ? "edit"
                    : /command|bash|shell|run_code/.test(name)
                      ? "command"
                      : /read/.test(name)
                        ? "read"
                        : /search|list/.test(name)
                          ? "search"
                          : /progress/.test(name)
                            ? "plan"
                            : "action";
  const labels = {
    task: ["Updating tasks", "Updated tasks", "Task update rejected"],
    check: ["Running check", "Recorded check", "Check failed"],
    monitor: [
      "Monitoring command",
      "Checked command",
      "Command monitoring failed",
    ],
    agent: [
      "Coordinating subagents",
      "Coordinated subagents",
      "Subagent action failed",
    ],
    question: ["Asking you", "Received your answer", "Question cancelled"],
    skill: ["Loading skills", "Loaded skills", "Skill loading failed"],
    goal: ["Checking goal", "Checked goal", "Goal update failed"],
    inspect: [
      "Inspecting project",
      "Inspected project",
      "Project inspection failed",
    ],
    edit: ["Editing", "Edited", "Edit failed"],
    command: ["Running", "Ran", "Command failed"],
    read: ["Reading", "Read", "Read failed"],
    search: ["Searching", "Searched", "Search failed"],
    plan: ["Updating plan", "Updated plan", "Plan update failed"],
    action: ["Running action", "Completed action", "Action failed"],
  };
  const detail = String(
    input.title ||
      input.question ||
      input.command ||
      input.path ||
      input.filePath ||
      input.pattern ||
      input.query ||
      (name === "run_code" ? `${input.language || ""} code`.trim() : "") ||
      (kind === "action" ? name.replaceAll("_", " ") : ""),
  );
  return {
    kind,
    active,
    failed,
    detail,
    label: labels[kind][failed ? 2 : active ? 0 : 1],
  };
}
export function activitySummary(parts: Part[]) {
  const active = parts.filter((p) => toolInfo(p).active);
  const failed = parts.filter((p) => toolInfo(p).failed);
  if (parts.length === 1) {
    const info = toolInfo(parts[0]);
    return `${info.label}${info.detail ? ` ${info.detail}` : ""}`;
  }
  if (active.length) {
    const info = toolInfo(active.at(-1)!);
    return `${info.label}${info.detail ? ` ${info.detail}` : ""} · ${parts.length} actions`;
  }
  const counts = new Map<string, number>();
  for (const part of parts.filter((p) => !toolInfo(p).failed)) {
    const kind = toolInfo(part).kind;
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  const fragments = Array.from(counts, ([kind, n]) => {
    if (kind === "edit") return `Edited ${n} ${n === 1 ? "file" : "files"}`;
    if (kind === "command")
      return `Ran ${n} ${n === 1 ? "command" : "commands"}`;
    if (kind === "read") return `Read ${n} ${n === 1 ? "file" : "files"}`;
    if (kind === "search") return `${n} ${n === 1 ? "search" : "searches"}`;
    if (kind === "task") return "Updated tasks";
    if (kind === "check") return "Recorded checks";
    if (kind === "monitor") return "Monitored commands";
    if (kind === "agent") return "Coordinated subagents";
    if (kind === "plan") return "Updated plan";
    if (kind === "question") return "Asked for input";
    if (kind === "skill") return "Loaded skills";
    if (kind === "goal") return "Checked goal";
    if (kind === "inspect") return "Inspected project";
    return `${n} ${n === 1 ? "action" : "actions"}`;
  });
  if (failed.length) fragments.push(`${failed.length} failed`);
  return fragments.join(" · ");
}
export const effortColors: Record<string, string> = {
  "": "#6698f5",
  minimal: "#56bdc9",
  low: "#55bf92",
  medium: "#7192ff",
  high: "#b58aff",
  xhigh: "#e89461",
  max: "#ee839f",
  ultra: "#ee839f",
};
/** Failed calls from the latest user turn, cleared only by a successful retry
 * of the same tool and target. Assistant prose is never execution evidence. */
export function unresolvedFailures(messages: Message[]): Part[] {
  const failures = new Map<string, Part>();
  for (const message of messages) {
    if (message.role === "user") failures.clear();
    for (const part of message.parts) {
      if (part.type !== "tool") continue;
      const input = (part.state?.input || {}) as Record<string, unknown>;
      const key = JSON.stringify([
        part.tool,
        input.path ??
          input.filePath ??
          input.id ??
          input.command ??
          input.tool ??
          input.question ??
          "",
      ]);
      if (part.state?.status === "error") failures.set(key, part);
      else if (part.state?.status === "completed") failures.delete(key);
    }
  }
  return [...failures.values()];
}
