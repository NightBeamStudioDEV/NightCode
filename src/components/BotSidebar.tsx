import { useEffect, useState } from "react";
import { Bot, Plus } from "lucide-react";
import type { Session, Snapshot } from "../shared";
export function BotSidebar({
  snapshot,
  selected,
  onOpen,
  onManage,
}: {
  snapshot: Snapshot;
  selected?: string;
  onOpen: (s: Session) => void;
  onManage: () => void;
}) {
  const [bots, setBots] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    const refresh = () =>
      void window.nightcode
        .invoke<any>("bots.list")
        .then((v) => {
          if (!disposed) setBots(v.bots);
        })
        .catch((e) => {
          if (!disposed) setError(e.message);
        });
    refresh();
    const off = window.nightcode.onEvent((e) => {
      if (e.type === "changed") refresh();
    });
    return () => {
      disposed = true;
      off();
    };
  }, []);
  return (
    <section className="bot-sidebar">
      <input
        aria-label="Search bot conversations"
        placeholder="Search conversations…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      {bots
        .filter((b) =>
          (
            b.name +
            " " +
            snapshot.sessions
              .filter((s) => s.botId === b.id)
              .map((s) => s.title)
              .join(" ")
          )
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((b) => {
          const sessions = snapshot.sessions
            .filter((s) => s.botId === b.id && !s.archived)
            .sort((a, c) => c.updated - a.updated);
          return (
            <div key={b.id} className="bot-sidebar-group">
              <div className="bot-sidebar-heading">
                <Bot />
                <strong>{b.name}</strong>
                <button
                  aria-label={"New chat with " + b.name}
                  onClick={() =>
                    void window.nightcode
                      .invoke<Session>("bots.open", { id: b.id })
                      .then(onOpen)
                      .catch((e) => setError(e.message))
                  }
                >
                  <Plus />
                </button>
              </div>
              {sessions.map((s) => (
                <button
                  className={
                    "bot-chat-row " + (s.id === selected ? "selected" : "")
                  }
                  key={s.id}
                  onClick={() => onOpen(s)}
                >
                  <span>{s.title}</span>
                  <small>
                    {new Date(s.updated).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </button>
              ))}
              {!sessions.length && (
                <small className="muted">Start a conversation with +</small>
              )}
            </div>
          );
        })}
      <button className="nav-item" onClick={onManage}>
        <Bot /> Manage bots
      </button>
    </section>
  );
}
