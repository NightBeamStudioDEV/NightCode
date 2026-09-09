import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packages = ["docx", "exceljs", "mammoth", "pdf-lib", "unpdf"];
const marker = "## Direct document, spreadsheet, and PDF toolkit dependencies";
const blocks = [];
for (const name of packages) {
  const pkg = JSON.parse(await readFile(resolve(root, "node_modules", name, "package.json"), "utf8"));
  const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt"];
  let license = "";
  for (const candidate of candidates) {
    try {
      license = await readFile(resolve(root, "node_modules", name, candidate), "utf8");
      break;
    } catch {}
  }
  if (!license) throw new Error(`Missing license for ${name}`);
  blocks.push(`### ${name} ${pkg.version} (${pkg.license || "see package"})\n\n${license.trim().replace(/[ \\t]+$/gm, "")}`);
}
const section = `${marker}\n\n${blocks.join("\n\n")}`;
for (const file of ["THIRD_PARTY_NOTICES.md", "resources/licenses/ThirdParty.txt"]) {
  const path = resolve(root, file);
  const current = await readFile(path, "utf8");
  const start = current.indexOf(marker);
  const next = start >= 0 ? current.slice(0, start).trimEnd() : current.trimEnd();
  await writeFile(path, `${next}\n\n${section}\n`, "utf8");
}
