import { useEffect, useState } from "react";
type Server = { name: string; type: string; location: string };
export function McpSettings({
  onChange,
}: {
  onChange: (items: Server[]) => void;
}) {
  const [servers, setServers] = useState<Server[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("remote");
  const [location, setLocation] = useState("");
  const [args, setArgs] = useState("");
  const [secrets, setSecrets] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const value = await window.nightcode.invoke<Server[]>("mcp.list");
    const items = Array.isArray(value) ? value : [];
    setServers(items);
    onChange(items);
  };
  useEffect(() => {
    void refresh().catch((e) => setMessage(e.message));
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mcp-settings">
      <summary>
        MCP servers <small>{servers.length} configured</small>
      </summary>
      <p className="muted">
        Connect a local server or a remote HTTP endpoint. Mention{" "}
        <code>@mcp:name</code> in chat to use it. Toolkit shortcuts include{" "}
        <code>@toolkit:browser</code> and <code>@toolkit:documents</code>.
      </p>
      {servers.map((server) => (
        <div className="mcp-server" key={server.name}>
          <div>
            <strong>{server.name}</strong>
            <small>{server.location}</small>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const result = await window.nightcode.invoke("mcp.test", {
                  name: server.name,
                });
                setMessage(
                  `${server.name}: connected · ${result.tools.length} tools available`,
                );
              })
            }
          >
            Test connection
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await window.nightcode.invoke("mcp.remove", {
                  name: server.name,
                });
                await refresh();
              })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <label>
        Server name
        <input
          aria-label="MCP server name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-server"
        />
      </label>
      <label>
        Connection
        <select
          aria-label="MCP connection type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setLocation("");
            setSecrets("");
          }}
        >
          <option value="remote">Remote HTTP / SSE</option>
          <option value="local">Local executable (stdio)</option>
        </select>
      </label>
      <label>
        {type === "remote" ? "Endpoint URL" : "Executable"}
        <input
          aria-label="MCP location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={type === "remote" ? "https://example.com/mcp" : "npx"}
        />
      </label>
      {type === "local" && (
        <label>
          Arguments (one per line)
          <textarea
            aria-label="MCP arguments"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder={"-y\n@package/mcp-server"}
          />
        </label>
      )}
      <label>
        {type === "remote"
          ? "Headers (optional JSON)"
          : "Environment variables (optional JSON)"}
        <textarea
          aria-label="MCP credentials"
          value={secrets}
          onChange={(e) => setSecrets(e.target.value)}
          placeholder={
            type === "remote"
              ? '{"Authorization":"Bearer …"}'
              : '{"API_KEY":"…"}'
          }
        />
      </label>
      <small className="muted">
        Connection settings are encrypted locally. Use headers for token
        authentication.
      </small>
      <button
        className="primary"
        disabled={busy || !name || !location}
        onClick={() =>
          void act(async () => {
            const credentials = secrets.trim() ? JSON.parse(secrets) : {};
            await window.nightcode.invoke("mcp.save", {
              name,
              type,
              url: type === "remote" ? location : "",
              command: type === "local" ? location : "",
              args: args.split(/\r?\n/).filter(Boolean),
              headers: type === "remote" ? credentials : {},
              environment: type === "local" ? credentials : {},
            });
            await refresh();
            setName("");
            setLocation("");
            setSecrets("");
            setArgs("");
            setMessage(
              "Server saved. Test the connection or mention it in chat.",
            );
          })
        }
      >
        Save MCP server
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
