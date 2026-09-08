import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import ignore from "ignore";

export async function canonical(file: string): Promise<string> {
  try {
    return await fs.realpath(file);
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
    const parent = path.dirname(file);
    if (parent === file) throw e;
    return path.join(await canonical(parent), path.basename(file));
  }
}
export async function contained(root: string, file: string) {
  const [r, f] = await Promise.all([canonical(root), canonical(file)]);
  const rel = path.relative(r, f);
  return (
    rel === "" ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  );
}
export async function readText(file: string): Promise<string | null> {
  try {
    const stat = await fs.stat(file);
    if (stat.size > 2 * 1024 * 1024)
      throw new Error("File exceeds the 2 MB text limit");
    const data = await fs.readFile(file);
    if (data.includes(0)) throw new Error("Binary files cannot be edited");
    return data.toString("utf8");
  } catch (e: any) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export async function applyReviewed(
  file: string,
  before: string | null,
  after: string | null,
) {
  if ((await readText(file)) !== before)
    throw new Error(
      "This file changed since the proposal. Ask the agent to read it again.",
    );
  if (after === null) {
    if (before !== null) await fs.unlink(file);
    return;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = path.join(
    path.dirname(file),
    ".nightcode-" + crypto.randomUUID() + ".tmp",
  );
  try {
    await fs.writeFile(temp, after, "utf8");
    if ((await readText(file)) !== before)
      throw new Error("Concurrent file change detected");
    for (let attempt = 0; ; attempt++) {
      if ((await readText(file)) !== before)
        throw new Error("Concurrent file change detected");
      try {
        await fs.rename(temp, file);
        break;
      } catch (error: any) {
        if (attempt >= 5 || !["EPERM", "EACCES", "EBUSY"].includes(error.code))
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
  } finally {
    await fs.rm(temp, { force: true });
  }
}
export async function listFiles(root: string, query = "", limit = 300) {
  const ig = ignore().add([
    ".git/",
    "node_modules/",
    ".env",
    ".env.*",
    "dist/",
    "build/",
    ".nightcode/",
  ]);
  try {
    ig.add(await fs.readFile(path.join(root, ".gitignore"), "utf8"));
  } catch {}
  const result: string[] = [];
  async function walk(dir: string) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      if (result.length >= limit) return;
      const abs = path.join(dir, ent.name);
      const rel = path.relative(root, abs).replaceAll("\\", "/");
      if (
        ent.isSymbolicLink() ||
        ig.ignores(rel + (ent.isDirectory() ? "/" : ""))
      )
        continue;
      if (ent.isDirectory()) await walk(abs);
      else if (rel.toLowerCase().includes(query.toLowerCase()))
        result.push(rel);
    }
  }
  await walk(root);
  return result;
}

/** Bounded inventory; ignored files are omitted. */
export async function inventory(root: string) {
  const files = await listFiles(root, "", 5001);
  const state: Record<string, string> = {};
  let limited = files.length > 5000;
  for (const file of files.slice(0, 5000)) {
    try {
      const stat = await fs.stat(path.join(root, file));
      state[file] =
        stat.size <= 2 * 1024 * 1024
          ? crypto
              .createHash("sha256")
              .update(await fs.readFile(path.join(root, file)))
              .digest("hex")
          : `${stat.size}:${stat.mtimeMs}`;
    } catch {
      limited = true;
    }
  }
  return { state, limited };
}
