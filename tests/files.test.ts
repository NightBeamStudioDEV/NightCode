import { afterEach, describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyReviewed,
  contained,
  listFiles,
  readText,
} from "../electron/files";
const roots: string[] = [];
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-files-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});
describe("reviewed file operations", () => {
  it("creates, updates, and deletes exactly reviewed content", async () => {
    const root = await fixture();
    const file = path.join(root, "nested", "test.txt");
    await applyReviewed(file, null, "before\r\n");
    expect(await readText(file)).toBe("before\r\n");
    await applyReviewed(file, "before\r\n", "after\r\n");
    expect(await readText(file)).toBe("after\r\n");
    await applyReviewed(file, "after\r\n", null);
    expect(await readText(file)).toBeNull();
  });
  it("preserves user edits when a proposal is stale", async () => {
    const root = await fixture();
    const file = path.join(root, "a.txt");
    await fs.writeFile(file, "user edit");
    await expect(applyReviewed(file, "old", "agent edit")).rejects.toThrow(
      "changed",
    );
    expect(await readText(file)).toBe("user edit");
  });
  it("does not overwrite a newly created file", async () => {
    const root = await fixture();
    const file = path.join(root, "new.txt");
    await fs.writeFile(file, "user created");
    await expect(applyReviewed(file, null, "agent")).rejects.toThrow("changed");
  });
  it("rejects traversal and resolves symlink escapes", async () => {
    const root = await fixture();
    const other = await fixture();
    expect(await contained(root, path.join(root, "..", "escape.txt"))).toBe(
      false,
    );
    await fs.symlink(other, path.join(root, "link"), "junction");
    expect(await contained(root, path.join(root, "link", "new.txt"))).toBe(
      false,
    );
    expect(await contained(root, path.join(root, "nested", "new.txt"))).toBe(
      true,
    );
  });
  it("omits ignored files, secrets, dependencies and symlinks", async () => {
    const root = await fixture();
    await fs.writeFile(path.join(root, ".gitignore"), "private.txt\n");
    for (const name of ["a.ts", ".env", "private.txt"])
      await fs.writeFile(path.join(root, name), "data");
    await fs.mkdir(path.join(root, "node_modules"));
    await fs.writeFile(path.join(root, "node_modules", "x.js"), "data");
    expect(await listFiles(root)).toEqual(expect.arrayContaining(["a.ts"]));
    expect(await listFiles(root)).not.toEqual(
      expect.arrayContaining([".env", "private.txt", "node_modules/x.js"]),
    );
  });
});
