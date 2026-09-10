import { expect, it } from "vitest";
import { requestedMcps, requestedToolkits } from "../src/mentions";
import { modelVariants } from "../src/modelVariants";
import { unresolvedFailures } from "../src/activity";
it("supports explicit and readable MCP/toolkit mentions without matching ordinary words", () => {
  expect(requestedMcps("@mcp:docs and @mcp browser @mcp:docs")).toEqual([
    "docs",
    "browser",
  ]);
  expect(
    requestedToolkits("Use @toolkit browser and @toolkit:documents.").map(
      (t) => t.id,
    ),
  ).toEqual(["toolkit:browser", "toolkit:documents"]);
  expect(requestedMcps("mcp:docs")).toEqual([]);
});
it("preserves supported max and disabled provider overrides", () => {
  expect(modelVariants("deepseek-v4-flash").max).toEqual({
    reasoningEffort: "max",
  });
  expect(
    modelVariants("deepseek-v4-pro", { max: { disabled: true } }).max,
  ).toEqual({ disabled: true });
  expect(modelVariants("unrelated-model")).toEqual({});
});
it("does not count a model success claim as a successful tool retry", () => {
  const failure: any = {
    type: "tool",
    tool: "nightcode_edit",
    state: {
      status: "error",
      input: { path: "a.ts" },
      error: "No active task",
    },
  };
  const messages: any[] = [
    {
      id: "a",
      role: "assistant",
      parts: [failure, { type: "text", text: "Goal verified." }],
    },
  ];
  expect(unresolvedFailures(messages)).toHaveLength(1);
  messages.push({
    id: "b",
    role: "assistant",
    parts: [{ ...failure, state: { ...failure.state, status: "completed" } }],
  });
  expect(unresolvedFailures(messages)).toHaveLength(0);
});
