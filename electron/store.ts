import initSqlJs, { type Database } from "sql.js";
import fs from "node:fs";
import path from "node:path";
export class Store {
  private db!: Database;
  constructor(private file: string) {}
  async open(wasm: string) {
    const SQL = await initSqlJs({ locateFile: () => wasm });
    this.db = fs.existsSync(this.file)
      ? new SQL.Database(fs.readFileSync(this.file))
      : new SQL.Database();
    this.db.run(
      "CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=1;",
    );
    this.save();
  }
  get<T>(key: string, fallback: T): T {
    const row = this.db.exec("SELECT value FROM state WHERE key = ?", [key]);
    return row[0]?.values[0]
      ? JSON.parse(String(row[0].values[0][0]))
      : fallback;
  }
  set(key: string, value: unknown) {
    this.db.run("INSERT OR REPLACE INTO state VALUES (?,?)", [
      key,
      JSON.stringify(value),
    ]);
    this.save();
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, this.db.export());
    fs.renameSync(tmp, this.file);
  }
}
