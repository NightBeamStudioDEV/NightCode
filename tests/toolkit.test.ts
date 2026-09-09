import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import initSqlJs from "sql.js";
vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}));
import { Toolkit, type ToolkitContext } from "../electron/toolkit";
import { SecretVault, publicAddress, requestUrl } from "../electron/network";
const wasm = path.resolve("node_modules/sql.js/dist/sql-wasm.wasm");
function setup() {
  const state = new Map();
  const store = {
    get: (k: string, f: any) => structuredClone(state.get(k) ?? f),
    set: (k: string, v: any) => state.set(k, structuredClone(v)),
  };
  return new Toolkit(
    store as any,
    {} as any,
    { jobs: () => [] } as any,
    wasm,
    () => {},
    () => {},
  );
}
describe("toolkit boundaries and documents", () => {
  it("roundtrips real Word, Excel, PDF and enforces SQLite read-only", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolkit-test-")),
      kit = setup();
    const c: ToolkitContext = {
      sessionId: "s",
      scope: "project:p",
      readOnly: false,
      delegated: false,
      alive: () => true,
      approve: async () => {},
      resolve: async (p) => path.join(root, p),
      write: async (p, b) => {
        await fs.writeFile(p, b);
      },
      command: async () => {},
      vision: async () => true,
    };
    for (const ext of ["docx", "xlsx", "pdf"]) {
      await kit.call(
        "write_document",
        {
          path: "report." + ext,
          content: "A real document",
          rows: [
            ["Name", "Count"],
            ["Checks", 3],
          ],
        },
        c,
      );
      const result = await kit.call(
        "read_document",
        { path: "report." + ext },
        c,
      );
      expect(JSON.stringify(result)).toContain(
        ext === "xlsx" ? "Checks" : "A real document",
      );
    }
    const SQL = await initSqlJs({ locateFile: () => wasm }),
      db = new SQL.Database();
    db.run(
      "CREATE TABLE test (value TEXT); INSERT INTO test VALUES ('original')",
    );
    await fs.writeFile(path.join(root, "test.sqlite"), db.export());
    db.close();
    const read = await kit.call(
      "database_query",
      { path: "test.sqlite", sql: "SELECT * FROM test" },
      c,
    );
    expect(read[0].values).toEqual([["original"]]);
    await expect(
      kit.call(
        "database_query",
        { path: "test.sqlite", sql: "SELECT * FROM test; DELETE FROM test" },
        c,
      ),
    ).rejects.toThrow();
    await expect(
      kit.call(
        "database_query",
        { path: "test.sqlite", sql: "DELETE FROM test", write: true },
        { ...c, readOnly: true },
      ),
    ).rejects.toThrow();
    await kit.call(
      "database_query",
      {
        path: "test.sqlite",
        sql: "UPDATE test SET value = ?",
        params: ["updated"],
        write: true,
      },
      c,
    );
    expect(
      (
        await kit.call(
          "database_query",
          { path: "test.sqlite", sql: "SELECT value FROM test" },
          c,
        )
      )[0].values,
    ).toEqual([["updated"]]);
    for (const file of await fs.readdir(root))
      await fs.unlink(path.join(root, file));
    await fs.rmdir(root);
  });
  it("isolates memory and rejects secret disclosure and read-only writes", async () => {
    const kit = setup(),
      c = {
        sessionId: "s",
        scope: "bot:one",
        readOnly: false,
        delegated: false,
      } as ToolkitContext;
    kit.vault.save({
      name: "token",
      origin: "https://example.com",
      value: "sensitive-test-value-123",
    });
    await expect(
      kit.call(
        "memory",
        {
          action: "save",
          title: "Unsafe",
          content: "sensitive-test-value-123",
        },
        c,
      ),
    ).rejects.toThrow("credentials");
    await kit.call(
      "memory",
      { action: "save", title: "Decision", content: "Use dark UI" },
      c,
    );
    expect(
      await kit.call("memory", { action: "list" }, { ...c, scope: "bot:two" }),
    ).toEqual([]);
    await expect(
      kit.call(
        "memory",
        { action: "save", title: "x", content: "y" },
        { ...c, readOnly: true },
      ),
    ).rejects.toThrow();
    expect(JSON.stringify(kit.vault.list())).not.toContain("sensitive");
    expect(kit.vault.redact("token=sensitive-test-value-123")).toBe(
      "token=[redacted]",
    );
    expect(() => kit.vault.headers("token", "https://evil.example")).toThrow(
      "different origin",
    );
  });
  it("blocks private and metadata addresses in HTTP APIs", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "192.168.1.1",
      "172.16.0.1",
      "::1",
      "::ffff:127.0.0.1",
      "fd00::1",
    ])
      expect(publicAddress(ip)).toBeFalsy();
    expect(publicAddress("8.8.8.8")).toBeTruthy();
    await expect(requestUrl("http://127.0.0.1:1")).rejects.toThrow("Private");
  });
});
