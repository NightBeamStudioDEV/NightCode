import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { parseSlash } from "../src/commands";
import { SkillLibrary, replaceExact, validateGoal } from "../electron/agent";
describe("agent commands and knowledge", () => {
  it("persists user skills and validates IDs before file access", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-skills-"));
    const root = path.resolve("resources/agent-skills"),
      file = () => path.join(dir, "skills.json");
    const library = new SkillLibrary(root, file);
    await library.save({
      id: "my-workflow",
      description: "My workflow",
      content: "Verify the result",
    });
    expect(await new SkillLibrary(root, file).load("my-workflow")).toBe(
      "Verify the result",
    );
    await expect(
      library.save({ id: "../escape", description: "Bad", content: "Bad" }),
    ).rejects.toThrow();
    await library.remove("game-director");
    await expect(
      new SkillLibrary(root, file).load("game-director"),
    ).rejects.toThrow(/Unknown/);
    await library.remove("my-workflow");
    expect((await library.list()).some((s) => s.id === "my-workflow")).toBe(
      false,
    );
  });
  it("routes plan and goal without confusing ordinary prompts", () => {
    expect(parseSlash("/plan mode")).toEqual({ mode: "Plan", text: "" });
    expect(parseSlash("/plan inspect physics")).toEqual({
      mode: "Plan",
      text: "inspect physics",
    });
    expect(parseSlash("/goal ship a racing game").goal).toBe(
      "ship a racing game",
    );
    expect(() => parseSlash("/goal")).toThrow(/objective/);
    expect(parseSlash("explain /plan").text).toBe("explain /plan");
    expect(() => parseSlash("/unknown")).toThrow(/Unknown/);
  });
  it("requires a unique exact match before replacement", () => {
    expect(replaceExact("alpha beta", "beta", "gamma")).toBe("alpha gamma");
    expect(() => replaceExact("a a", "a", "b")).toThrow(/exactly once/);
    expect(() => replaceExact(null, "a", "b")).toThrow(/does not exist/);
  });
  it("requires evidence for completed or blocked goals", () => {
    expect(() =>
      validateGoal({ objective: "Ship", status: "complete" }),
    ).toThrow(/evidence/);
    expect(
      validateGoal({
        objective: "Ship",
        status: "complete",
        evidence: "Build passed and acceptance checks verified",
      }).status,
    ).toBe("complete");
  });
  it("loads every packaged skill and rejects traversal", async () => {
    const library = new SkillLibrary(path.resolve("resources/agent-skills"));
    const index = await library.list();
    expect(index.length).toBe(9);
    for (const skill of index)
      expect(await library.load(skill.id)).toContain(`name: ${skill.id}`);
    await expect(library.load("../icon.png")).rejects.toThrow(/Unknown/);
  });
});
