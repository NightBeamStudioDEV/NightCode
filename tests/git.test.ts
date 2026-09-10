import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { git, gitStatus, gitAction } from "../electron/git";

it("stages reviewed files, commits, compares branches and pushes to a local remote", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-git-"));
  const repo = path.join(root, "repo"),
    remote = path.join(root, "remote.git");
  await fs.mkdir(repo);
  await fs.mkdir(remote);
  try {
    await git(remote, ["init", "--bare"]);
    await git(repo, ["init", "-b", "main"]);
    await git(repo, ["config", "user.name", "Test"]);
    await git(repo, ["config", "core.autocrlf", "false"]);
    await git(repo, ["config", "user.email", "test@example.invalid"]);
    await git(repo, ["remote", "add", "origin", remote]);
    await fs.writeFile(path.join(repo, "hello.txt"), "original\n");
    expect(await gitStatus(repo)).toMatchObject({
      repository: true,
      branch: "main",
      changes: [{ status: "??", path: "hello.txt" }],
    });
    await expect(
      gitAction(repo, { action: "commit", message: "unreviewed" }),
    ).rejects.toThrow();
    await gitAction(repo, { action: "stage" });
    await gitAction(repo, {
      action: "commit-push",
      message: "Initial",
      remote: "origin",
    });
    expect((await git(remote, ["rev-parse", "refs/heads/main"])).trim()).toBe(
      (await git(repo, ["rev-parse", "HEAD"])).trim(),
    );
    await gitAction(repo, { action: "create", branch: "feature" });
    await fs.writeFile(path.join(repo, "hello.txt"), "updated\n");
    expect(await gitAction(repo, { action: "diff" })).toContain("+updated");
    await gitAction(repo, { action: "stage" });
    await gitAction(repo, { action: "commit", message: "Update" });
    expect(
      await gitAction(repo, { action: "compare", branch: "main" }),
    ).toContain("+updated");
    await gitAction(repo, { action: "switch", branch: "main" });
    expect(await fs.readFile(path.join(repo, "hello.txt"), "utf8")).toBe(
      "original\n",
    );
    await expect(
      gitAction(repo, { action: "switch", branch: "--detach" }),
    ).rejects.toThrow();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}, 30000);
