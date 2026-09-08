import type { Mode } from "./shared";
export const slashCommands = [
  { name: "plan", description: "Read-only planning · /plan [task]" },
  { name: "code", description: "Implement changes · /code [task]" },
  {
    name: "goal",
    description: "Set a persistent objective · /goal <objective>",
  },
  { name: "skills", description: "Browse the built-in skill library" },
  {
    name: "game",
    description: "Start the game-development workflow · /game <brief>",
  },
  { name: "test", description: "Verify the current project · /test [scope]" },
  { name: "review", description: "Read-only project review · /review [scope]" },
  { name: "help", description: "Show available commands" },
] as const;
export function parseSlash(text: string): {
  text: string;
  mode?: Mode;
  goal?: string;
  local?: "skills" | "help";
} {
  const match = text.trim().match(/^\/(\w+)(?:\s+([\s\S]*))?$/);
  if (!match) return { text };
  const name = match[1].toLowerCase(),
    argument = (match[2] || "").trim();
  if (name === "plan")
    return {
      mode: "Plan",
      text: argument.toLowerCase() === "mode" ? "" : argument,
    };
  if (name === "code")
    return {
      mode: "Code",
      text: argument.toLowerCase() === "mode" ? "" : argument,
    };
  if (name === "skills" || name === "help") return { text: "", local: name };
  if (name === "goal") {
    if (!argument)
      throw new Error(
        "Use /goal followed by the objective you want to achieve.",
      );
    return { text: argument, goal: argument, mode: "Agent" };
  }
  if (name === "game")
    return {
      mode: "Code",
      text: `Use the game-director skill to build this game: ${argument || "Inspect the current game and identify the next playable milestone."}`,
    };
  if (name === "test")
    return {
      mode: "Code",
      text: `Inspect and run appropriate project verification. ${argument || "Check the current implementation."} Report actual results and blockers.`,
    };
  if (name === "review")
    return {
      mode: "Plan",
      text: `Review the project without modifying files. ${argument || "Find actionable correctness and usability issues."}`,
    };
  throw new Error(`Unknown command /${name}. Use /help to see commands.`);
}
