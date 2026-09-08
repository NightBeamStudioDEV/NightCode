import { describe, expect, it } from "vitest";
import { activitySummary, buildFeed, toolInfo } from "../src/activity";
import type { Message } from "../src/shared";
const tool = (name: string, status = "completed") => ({
  type: "tool",
  tool: `nightcode_${name}`,
  state: { status, input: { path: "src/app.ts" } },
});
describe("conversation activity", () => {
  it("joins tool-only assistant messages across engine metadata, preserving prose and user boundaries", () => {
    const messages: Message[] = [
      { id: "1", role: "assistant", parts: [tool("read_file")] },
      {
        id: "2",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "text", text: "  " },
          tool("propose_edit"),
        ],
      },
      {
        id: "3",
        role: "assistant",
        parts: [{ type: "text", text: "Updated the view." }],
      },
      { id: "4", role: "assistant", parts: [tool("run_command")] },
      { id: "5", role: "user", parts: [{ type: "text", text: "Continue" }] },
      { id: "6", role: "assistant", parts: [tool("read_file")] },
    ];
    const feed = buildFeed(messages);
    expect(feed).toHaveLength(5);
    expect(feed[0].tools).toHaveLength(2);
    expect(feed[1].text).toBe("Updated the view.");
    expect(feed[3].role).toBe("user");
  });
  it("never describes a failed edit as completed", () => {
    expect(activitySummary([tool("propose_edit", "error")])).toBe(
      "Edit failed src/app.ts",
    );
    expect(
      activitySummary([tool("propose_edit", "error"), tool("read_file")]),
    ).toBe("Read 1 file · 1 failed");
  });
  it("uses specific labels for reads, searches, plans and pending commands", () => {
    expect(toolInfo(tool("read_file")).label).toBe("Read");
    expect(toolInfo(tool("search_files")).label).toBe("Searched");
    expect(toolInfo(tool("report_progress")).label).toBe("Updated plan");
    expect(toolInfo(tool("run_command", "running")).active).toBe(true);
  });
});
