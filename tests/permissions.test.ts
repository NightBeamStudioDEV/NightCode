import { expect, it } from "vitest";
import { autoApprove } from "../electron/permissions";
it("asks by default and gives full access only when selected", () => {
  expect(autoApprove("ask", { kind: "command", command: "pwd" })).toBe(false);
  expect(autoApprove("full", { kind: "edit", after: null })).toBe(true);
});
it("automatic mode asks for deletion, access, unknown commands and shell injection", () => {
  expect(autoApprove("auto", { kind: "edit", after: "content" })).toBe(true);
  expect(autoApprove("auto", { kind: "edit", after: null })).toBe(false);
  expect(autoApprove("auto", { kind: "access" })).toBe(false);
  for (const command of [
    "git status; Remove-Item x",
    "git diff > x",
    "git status\nwhoami",
    "npm test",
    "powershell -c pwd",
  ])
    expect(autoApprove("auto", { kind: "command", command })).toBe(false);
  expect(
    autoApprove("auto", { kind: "command", command: "git status --short" }),
  ).toBe(true);
});
