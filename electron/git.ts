import { execFile } from "node:child_process";

export function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd,
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GCM_INTERACTIVE: "Never",
        },
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr.trim() || error.message));
        else resolve(stdout);
      },
    );
  });
}

export async function gitStatus(cwd: string) {
  try {
    await git(cwd, ["rev-parse", "--show-toplevel"]);
  } catch {
    return { repository: false as const };
  }
  const [branch, refs, files, staged, unstaged, remotes, upstream] =
    await Promise.all([
      git(cwd, ["branch", "--show-current"]),
      git(cwd, [
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads",
        "refs/remotes",
      ]),
      git(cwd, ["status", "--porcelain=v1", "-z"]),
      git(cwd, ["diff", "--cached", "--numstat"]),
      git(cwd, ["diff", "--numstat"]),
      git(cwd, ["remote"]),
      git(cwd, ["rev-parse", "--abbrev-ref", "@{upstream}"]).catch(() => ""),
    ]);
  let added = 0,
    removed = 0;
  for (const line of (staged + unstaged).split("\n")) {
    const [a, d] = line.split("\t");
    added += Number(a) || 0;
    removed += Number(d) || 0;
  }
  const entries = files.split("\0").filter(Boolean);
  const changes: { status: string; path: string }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    changes.push({ status: entry.slice(0, 2), path: entry.slice(3) });
    if (/[RC]/.test(entry.slice(0, 2))) i++;
  }
  return {
    repository: true as const,
    branch: branch.trim(),
    branches: refs.trim().split("\n").filter(Boolean),
    changes,
    added,
    removed,
    remotes: remotes.trim().split("\n").filter(Boolean),
    upstream: upstream.trim(),
  };
}

export async function gitAction(
  cwd: string,
  input: {
    action: string;
    message?: string;
    branch?: string;
    remote?: string;
  },
): Promise<string> {
  switch (input.action) {
    case "stage":
      return git(cwd, ["add", "--all", "--", "."]);
    case "commit":
    case "commit-push": {
      if (!input.message?.trim()) throw new Error("Enter a commit message.");
      const output = await git(cwd, ["commit", "-m", input.message.trim()]);
      if (input.action === "commit-push") {
        try {
          return (
            output +
            (await gitAction(cwd, { action: "push", remote: input.remote }))
          );
        } catch (error: any) {
          throw new Error("Commit created, but push failed: " + error.message);
        }
      }
      return output;
    }
    case "push": {
      const state = await gitStatus(cwd);
      if (!state.repository || !state.branch)
        throw new Error("Check out a branch before pushing.");
      if (state.upstream) return git(cwd, ["push"]);
      if (!input.remote || !state.remotes.includes(input.remote))
        throw new Error("Choose a remote.");
      return git(cwd, ["push", "--set-upstream", input.remote, state.branch]);
    }
    case "switch":
    case "create":
      if (!input.branch || input.branch.startsWith("-"))
        throw new Error("Enter a valid branch name.");
      await git(cwd, ["check-ref-format", "--branch", input.branch]);
      return git(
        cwd,
        input.action === "create"
          ? ["switch", "-c", input.branch]
          : ["switch", input.branch],
      );
    case "diff":
      return (
        (await git(cwd, ["diff", "--no-ext-diff", "--no-textconv"])) +
        (await git(cwd, ["diff", "--cached", "--no-ext-diff", "--no-textconv"]))
      );
    case "compare": {
      if (!input.branch || input.branch.startsWith("-"))
        throw new Error("Choose a branch to compare.");
      const ref = (
        await git(cwd, [
          "rev-parse",
          "--verify",
          "--end-of-options",
          input.branch + "^{commit}",
        ])
      ).trim();
      return git(cwd, [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        ref + "...HEAD",
        "--",
      ]);
    }
    default:
      throw new Error("Unknown Git action.");
  }
}
