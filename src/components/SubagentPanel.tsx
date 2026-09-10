import { useEffect, useState } from "react";
import type { Message, Subagent } from "../shared";
import { ConversationFeed } from "./Conversation";
export function SubagentPanel({ agents }: { agents: Subagent[] }) {
  const [selected, setSelected] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [error, setError] = useState("");
  const agent = agents.find((a) => a.id === selected);
  useEffect(() => {
    setMessages([]);
    setError("");
    if (!selected) return;
    let disposed = false,
      fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const raw = await window.nightcode.invoke<any[]>("subagents.messages", {
          id: selected,
        });
        if (!disposed)
          setMessages(raw.map((m) => ({ ...m.info, parts: m.parts })));
      } catch (e: any) {
        if (!disposed) setError(e.message);
      } finally {
        fetching = false;
      }
    };
    void load();
    const off = window.nightcode.onEvent((e) => {
      if (e.type === "subagents") void load();
    });
    return () => {
      disposed = true;
      off();
    };
  }, [selected]);
  if (!agents.length) return null;
  return (
    <section className="subagent-panel" aria-label="Subagents">
      <div className="manager-toolbar">
        <strong>Subagents</strong>
        <small>
          {
            agents.filter(
              (a) => a.status === "running" || a.status === "starting",
            ).length
          }{" "}
          working
        </small>
      </div>
      <div className="subagent-cards">
        {agents.map((a) => (
          <button
            key={a.id}
            aria-expanded={selected === a.id}
            onClick={() => setSelected(selected === a.id ? "" : a.id)}
          >
            <i className={`agent-status ${a.status}`} />
            <span>
              <strong>{a.title}</strong>
              <small>
                {a.role} · {a.status}
                {a.projectName && ` · ${a.projectName}`}
                {a.branch && ` · ${a.branch}`}
              </small>
              {a.progress && <small>{a.progress}</small>}
            </span>
            <span>↗</span>
          </button>
        ))}
      </div>
      {agent && (
        <div className="spectator">
          <div className="manager-toolbar">
            <strong>{agent.title}</strong>
            <span />
            {["running", "starting"].includes(agent.status) && (
              <button
                onClick={() =>
                  void window.nightcode
                    .invoke("subagents.stop", { id: selected })
                    .catch((e) => setError(e.message))
                }
              >
                Stop agent
              </button>
            )}
            <button onClick={() => setSelected("")}>Close</button>
          </div>
          <p className="agent-context">
            {agent.projectPath}
            {agent.branch ? ` · ${agent.branch}` : ""}
          </p>
          {!!agent.paths?.length && (
            <p className="agent-context">Owns: {agent.paths.join(", ")}</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="spectator-feed">
            <ConversationFeed messages={messages} />
            {!messages.length && (
              <p className="muted">
                {agent.status === "starting"
                  ? "Starting the agent…"
                  : agent.result || "Waiting for the first update…"}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
