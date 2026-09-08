import type { Approval, PermissionMode } from "../src/shared";
/** Deliberately small allowlist: shell syntax, arguments and aliases cannot slip through. */
export function autoApprove(
  mode: PermissionMode,
  action: Pick<Approval, "kind" | "after" | "command">,
): boolean {
  if (mode === "full") return true;
  if (mode !== "auto") return false;
  if (action.kind === "edit") return action.after !== null;
  if (action.kind === "command")
    return /^(git (status(?: --short)?|diff(?: --stat)?|log -[1-9][0-9]? --oneline)|pwd|Get-Location)$/i.test(
      action.command?.trim() || "",
    );
  return false;
}
