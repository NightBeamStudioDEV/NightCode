import { expect, it } from "vitest";
import { McpConnections, mcpConfig } from "../electron/mcp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
it("connects to a local stdio MCP and follows paginated tool discovery", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-mcp-"));
  const script = path.join(root, "server.cjs");
  await fs.writeFile(
    script,
    `const rl = require('node:readline').createInterface({input: process.stdin});
rl.on('line', line => { const r = JSON.parse(line); if (r.id === undefined) return;
const result = r.method === 'initialize' ? {protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'local-fixture',version:'1'}} : r.method === 'tools/list' ? {tools:[{name:r.params?.cursor ? 'second' : 'first',inputSchema:{type:'object'}}], ...(r.params?.cursor ? {} : {nextCursor:'page2'})} : {content:[{type:'text',text:r.params?.arguments?.message || 'ok'}]};
process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result})+'\\n'); });`,
  );
  const manager = new McpConnections(() => [
    mcpConfig.parse({
      name: "local",
      type: "local",
      command: process.execPath,
      args: [script],
    }),
  ]);
  try {
    expect((await manager.tools("local")).map((t) => t.name)).toEqual([
      "first",
      "second",
    ]);
    expect(
      await manager.call("local", "first", { message: "stdio works" }),
    ).toMatchObject({ content: [{ type: "text", text: "stdio works" }] });
    await expect(manager.tools("missing")).rejects.toThrow("Unknown MCP");
  } finally {
    await manager.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
