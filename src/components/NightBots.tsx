import { useEffect, useState } from "react";
import {
  Bot,
  Plus,
  Play,
  Pencil,
  Trash2,
  ArrowLeft,
  Clock,
  KeyRound,
  Brain,
  Globe,
  Check,
  Search,
  ChevronRight,
} from "lucide-react";
import type { Snapshot, Session } from "../shared";
const api = window.nightcode;
type BotProfile = {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  projectId: string;
  providerId: string;
  model: string;
  color: string;
};
const templates = [
  {
    name: "Research partner",
    description: "Compare sources and turn findings into a useful brief.",
    instructions:
      "Research the user’s topic using current sources. Open original pages, compare evidence, cite source URLs, and distinguish facts from inference. Ask focused questions when the brief is ambiguous.",
    color: "blue",
  },
  {
    name: "Project companion",
    description:
      "Follow project work, review changes, and run meaningful checks.",
    instructions:
      "Help maintain the selected project. Inspect existing patterns, make scoped changes, verify behavior with meaningful tests, and clearly report outstanding work. Keep useful project decisions in memory.",
    color: "violet",
  },
  {
    name: "Daily assistant",
    description: "Organize notes, prepare drafts, and check your calendar.",
    instructions:
      "Help the user organize work and prepare useful drafts. Use configured connections only. Confirm recipients, event details, and external changes with the user before submitting them. Keep private information out of unrelated tasks.",
    color: "emerald",
  },
];
export function NightBots({
  snapshot,
  onChat,
  initialTab = "bots",
  newBotKey = 0,
}: {
  snapshot: Snapshot;
  onChat: (session: Session, bot?: BotProfile) => void;
  initialTab?: string;
  newBotKey?: number;
}) {
  const [data, setData] = useState<any>({
      bots: [],
      jobs: [],
      memories: [],
      secrets: [],
    }),
    [tab, setTab] = useState(initialTab),
    [edit, setEdit] = useState<BotProfile | null>(null),
    [job, setJob] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [confirm, setConfirm] = useState(""),
    [notice, setNotice] = useState("");
  const [secret, setSecret] = useState({
    name: "microsoft365",
    origin: "https://graph.microsoft.com",
    header: "Authorization",
    prefix: "Bearer ",
    value: "",
  });
  const [catalog, setCatalog] = useState<any[]>([]);
  const refresh = async () => setData(await api.invoke("bots.list"));
  const blank = (template?: any): BotProfile => ({
    name: "",
    description: "",
    instructions: "",
    color: "violet",
    projectId: "",
    providerId: snapshot.providers[0]?.id || "",
    model: snapshot.providers[0]?.model || "",
    ...template,
  });
  useEffect(() => {
    void refresh().catch((e: any) => setError(e.message));
    void api
      .invoke<any[]>("providers.list")
      .then(setCatalog)
      .catch(() => {});
    const off = api.onEvent((e) => {
      if (e.type === "changed") void refresh().catch(() => {});
    });
    return off;
  }, []);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    if (newBotKey) {
      setTab("bots");
      setEdit(blank());
    }
  }, [newBotKey]);
  async function act(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(
        e.message.replace(/^Error invoking remote method '[^']+': Error: /, ""),
      );
    } finally {
      setBusy(false);
    }
  }
  const open = async (bot: BotProfile) => {
    const session = await api.invoke<Session>("bots.open", { id: bot.id });
    onChat(session, bot);
  };
  const remove = (id: string, action: string) => {
    if (confirm !== id) {
      setConfirm(id);
      return;
    }
    void act(async () => {
      await api.invoke(action, { id });
      setConfirm("");
    });
  };
  const capabilities = [
    [
      "Web search & reader",
      "Search current sources and extract public webpages.",
      "Built in",
    ],
    [
      "Browser control",
      "Navigate, click, type, read pages, and capture screenshots.",
      "Built in",
    ],
    [
      "Terminal & code",
      "PowerShell commands; JavaScript and Python execution.",
      "Local runtimes",
    ],
    [
      "Files & patches",
      "Read, search, replace, review edits, and move files.",
      "Built in",
    ],
    [
      "Memory & tasks",
      "Persistent notes, acceptance criteria, and retained checks.",
      "Built in",
    ],
    [
      "Schedules & triggers",
      "One-time jobs, recurring work, and file-change monitoring.",
      "App open",
    ],
    [
      "HTTP & secrets",
      "Scoped encrypted keys, API requests, and redacted output.",
      "Configure keys",
    ],
    [
      "Email & calendar",
      "Microsoft 365 mail, drafts, replies, sending, and events.",
      "Graph token",
    ],
    [
      "Documents & database",
      "PDF, Word, Excel, CSV, and project SQLite queries.",
      "Built in",
    ],
    [
      "Vision & subagents",
      "Images, browser screenshots, and bounded delegation.",
      "Model dependent",
    ],
  ];
  return (
    <div className="nightbots-page">
      <header className="bots-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL TEAM</span>
          <h1>
            <Bot /> NightBots
          </h1>
          <p>Give a bot a purpose. Keep its context. Follow its work.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setTab("bots");
            setEdit(blank());
          }}
        >
          <Plus size={17} /> Create bot
        </button>
      </header>
      <nav className="bots-nav" aria-label="NightBots sections">
        {[
          ["bots", "Bots", Bot],
          ["schedules", "Schedules", Clock],
          ["memory", "Memory", Brain],
          ["connections", "Connections", KeyRound],
          ["toolkit", "Toolkit", Globe],
        ].map(([id, label, Icon]: any) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setEdit(null);
              setJob(null);
              setConfirm("");
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="bots-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="bots-notice">
          {notice}
        </p>
      )}
      {tab === "bots" &&
        (edit ? (
          <form
            className="bot-editor"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await api.invoke("bots.save", edit);
                setEdit(null);
              });
            }}
          >
            <button
              type="button"
              className="text-button"
              onClick={() => setEdit(null)}
            >
              <ArrowLeft size={16} /> All bots
            </button>
            <h2>{edit.id ? "Edit bot" : "Create your NightBot"}</h2>
            <div className="bot-fields">
              <label>
                Name
                <input
                  required
                  maxLength={80}
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </label>
              <label>
                Short description
                <input
                  maxLength={240}
                  value={edit.description}
                  onChange={(e) =>
                    setEdit({ ...edit, description: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Instructions
              <textarea
                required
                rows={6}
                maxLength={12000}
                placeholder="What should this bot help with? How should it work?"
                value={edit.instructions}
                onChange={(e) =>
                  setEdit({ ...edit, instructions: e.target.value })
                }
              />
            </label>
            <label>
              Project
              <select
                aria-label="Project"
                value={edit.projectId}
                onChange={(e) =>
                  setEdit({ ...edit, projectId: e.target.value })
                }
              >
                <option value="">
                  Web and personal tasks · no local folders
                </option>
                {snapshot.projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>Provider</label>
            <div className="provider-cards">
              {snapshot.providers.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={edit.providerId === p.id}
                  onClick={() =>
                    setEdit({ ...edit, providerId: p.id, model: p.model })
                  }
                >
                  {p.name}
                  {edit.providerId === p.id && <Check size={16} />}
                </button>
              ))}
            </div>
            {!snapshot.providers.length && (
              <p className="muted">
                Connect a model provider in Settings before saving a bot.
              </p>
            )}
            <label>
              Model
              <input
                required
                list="bot-models"
                value={edit.model}
                onChange={(e) => setEdit({ ...edit, model: e.target.value })}
              />
              <datalist id="bot-models">
                {(
                  catalog.find((p) => p.id === edit.providerId)?.models || []
                ).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </datalist>
            </label>
            <div className="bot-colors" aria-label="Bot color">
              {["blue", "violet", "emerald", "rose"].map((color) => (
                <button
                  type="button"
                  key={color}
                  data-color={color}
                  aria-label={color + " bot color"}
                  aria-pressed={edit.color === color}
                  onClick={() => setEdit({ ...edit, color })}
                >
                  {edit.color === color && <Check size={14} />}
                </button>
              ))}
            </div>
            <button className="primary" disabled={busy || !edit.providerId}>
              Save bot
            </button>
          </form>
        ) : (
          <>
            <div className="bot-search">
              <Search size={16} />
              <input
                aria-label="Search bots"
                placeholder="Find a bot…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="bot-grid">
              {data.bots
                .filter((b: BotProfile) =>
                  (b.name + " " + b.description)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((b: BotProfile) => (
                  <article className="bot-card" key={b.id} data-color={b.color}>
                    <div className="bot-card-top">
                      <span className="bot-avatar">
                        <Bot />
                      </span>
                      <div className="bot-card-actions">
                        <button
                          aria-label={"Edit " + b.name}
                          onClick={() => setEdit(b)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label={"Delete " + b.name}
                          onClick={() => remove(b.id!, "bots.remove")}
                        >
                          {confirm === b.id ? "Confirm" : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>
                    <h2>{b.name}</h2>
                    <p>{b.description || "Ready for your next task."}</p>
                    <small>
                      {snapshot.providers.find((p) => p.id === b.providerId)
                        ?.name || "Provider unavailable"}{" "}
                      · {b.model}
                    </small>
                    <button
                      className="bot-start"
                      disabled={busy}
                      onClick={() => void act(() => open(b))}
                    >
                      <Play size={15} /> Start conversation{" "}
                      <ChevronRight size={15} />
                    </button>
                    <div className="bot-history">
                      {snapshot.sessions
                        .filter((s) => s.botId === b.id && !s.archived)
                        .slice(0, 3)
                        .map((s) => (
                          <button key={s.id} onClick={() => onChat(s, b)}>
                            {s.title}
                          </button>
                        ))}
                    </div>
                  </article>
                ))}
            </div>
            {!data.bots.length && (
              <div className="bots-empty">
                <h2>What would you like help with?</h2>
                <p>Start from a purpose, then make it yours.</p>
                <div className="bot-grid">
                  {templates.map((t) => (
                    <button
                      className="bot-template"
                      key={t.name}
                      onClick={() => setEdit(blank(t))}
                    >
                      <Bot />
                      <strong>{t.name}</strong>
                      <span>{t.description}</span>
                      <span className="text-accent">
                        Customize <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ))}
      {tab === "schedules" && (
        <>
          <div className="bots-section-heading">
            <div>
              <h2>Work that comes back on time.</h2>
              <p>
                Runs while NightCode is open. Jobs wait for the current agent to
                finish and keep action approvals.
              </p>
            </div>
            <button
              disabled={!data.bots.length}
              onClick={() =>
                setJob({
                  botId: data.bots[0]?.id,
                  name: "",
                  prompt: "",
                  kind: "interval",
                  intervalMinutes: 60,
                  nextRun: Date.now() + 60000,
                  watchPath: "",
                  enabled: true,
                })
              }
            >
              <Plus size={16} /> Add schedule
            </button>
          </div>
          {job && (
            <form
              className="bot-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await api.invoke("bots.schedule", job);
                  setJob(null);
                });
              }}
            >
              <h3>{job.id ? "Edit schedule" : "New schedule"}</h3>
              <label>
                Name
                <input
                  required
                  value={job.name}
                  onChange={(e) => setJob({ ...job, name: e.target.value })}
                />
              </label>
              <label>
                Bot
                <select
                  value={job.botId}
                  onChange={(e) => setJob({ ...job, botId: e.target.value })}
                >
                  {data.bots.map((b: BotProfile) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Task
                <textarea
                  required
                  rows={3}
                  value={job.prompt}
                  onChange={(e) => setJob({ ...job, prompt: e.target.value })}
                />
              </label>
              <div className="provider-cards">
                {[
                  ["once", "Once"],
                  ["interval", "Repeat"],
                  ["file", "File changes"],
                ].map(([kind, label]) => (
                  <button
                    type="button"
                    key={kind}
                    aria-pressed={job.kind === kind}
                    onClick={() => setJob({ ...job, kind })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {job.kind === "once" ? (
                <label>
                  Run at
                  <input
                    type="datetime-local"
                    required
                    value={new Date(
                      job.nextRun - new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)}
                    onChange={(e) => {
                      const value = new Date(e.target.value).getTime();
                      if (Number.isFinite(value))
                        setJob({ ...job, nextRun: value });
                    }}
                  />
                </label>
              ) : (
                <label>
                  {job.kind === "file"
                    ? "Check every (minutes)"
                    : "Repeat every (minutes)"}
                  <input
                    type="number"
                    min={1}
                    max={525600}
                    value={job.intervalMinutes}
                    onChange={(e) =>
                      setJob({
                        ...job,
                        intervalMinutes: Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
              {job.kind === "file" && (
                <label>
                  Project file to watch
                  <input
                    required
                    placeholder="src/main.ts or .git/HEAD"
                    value={job.watchPath}
                    onChange={(e) =>
                      setJob({ ...job, watchPath: e.target.value })
                    }
                  />
                </label>
              )}
              <div className="bot-fields">
                <button type="button" onClick={() => setJob(null)}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  Save schedule
                </button>
              </div>
            </form>
          )}
          {data.jobs.map((j: any) => (
            <article className="job-card" key={j.id}>
              <Clock size={19} />
              <div>
                <strong>{j.name}</strong>
                <p>
                  {data.bots.find((b: BotProfile) => b.id === j.botId)?.name} ·{" "}
                  {j.kind === "file"
                    ? "File change"
                    : j.kind === "once"
                      ? "Once"
                      : "Every " + j.intervalMinutes + " min"}{" "}
                  ·{" "}
                  {j.enabled
                    ? "Next check " + new Date(j.nextRun).toLocaleString()
                    : "Paused"}
                </p>
                {j.error && <p role="alert">{j.error}</p>}
                {j.lastSessionId && (
                  <button
                    className="text-button"
                    onClick={() => {
                      const s = snapshot.sessions.find(
                        (s) => s.id === j.lastSessionId,
                      );
                      if (s) onChat(s);
                    }}
                  >
                    Open last run
                  </button>
                )}
              </div>
              <button
                onClick={() =>
                  void act(async () => {
                    await api.invoke("bots.schedule", {
                      ...j,
                      enabled: !j.enabled,
                    });
                  })
                }
              >
                {j.enabled ? "Pause" : "Enable"}
              </button>
              <button
                aria-label={"Edit schedule " + j.name}
                onClick={() => setJob(j)}
              >
                <Pencil size={15} />
              </button>
              <button
                aria-label={"Delete schedule " + j.name}
                onClick={() => remove(j.id, "bots.unschedule")}
              >
                {confirm === j.id ? "Confirm" : <Trash2 size={15} />}
              </button>
            </article>
          ))}
          {!data.jobs.length && !job && (
            <p className="bots-empty">
              Create a bot, then give it a schedule or a file to watch.
            </p>
          )}
        </>
      )}
      {tab === "memory" && (
        <>
          <h2>Context that stays useful.</h2>
          <p className="muted">
            Bots and project agents can save notes across conversations. Review
            or remove them here.
          </p>
          {data.memories.map((m: any) => (
            <article className="memory-card" key={m.id}>
              <Brain size={18} />
              <div>
                <strong>{m.title}</strong>
                <p>{m.content}</p>
                <small>
                  {m.scope.startsWith("bot:")
                    ? data.bots.find(
                        (b: BotProfile) => "bot:" + b.id === m.scope,
                      )?.name || "Removed bot"
                    : snapshot.projects.find(
                        (p) => "project:" + p.id === m.scope,
                      )?.name || "Conversation"}
                </small>
              </div>
              <button
                aria-label={"Delete memory " + m.title}
                onClick={() => remove(m.id, "memory.remove")}
              >
                {confirm === m.id ? "Confirm" : <Trash2 size={15} />}
              </button>
            </article>
          ))}
          {!data.memories.length && (
            <p className="bots-empty">
              Ask a bot to remember a preference or a project decision.
            </p>
          )}
        </>
      )}
      {tab === "connections" && (
        <>
          <h2>Keys stay with the host.</h2>
          <p className="muted">
            Agents see connection names. Tokens are encrypted on this device and
            sent only to the origin you choose.
          </p>
          <div className="provider-cards">
            <button
              onClick={() =>
                setSecret({
                  name: "microsoft365",
                  origin: "https://graph.microsoft.com",
                  header: "Authorization",
                  prefix: "Bearer ",
                  value: "",
                })
              }
            >
              Microsoft 365 · Mail & Calendar
            </button>
            <button
              onClick={() =>
                setSecret({
                  name: "my-api",
                  origin: "",
                  header: "Authorization",
                  prefix: "Bearer ",
                  value: "",
                })
              }
            >
              Custom API
            </button>
          </div>
          <form
            className="bot-editor"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await api.invoke("secrets.save", secret);
                setSecret({ ...secret, value: "" });
                setNotice(
                  "Connection saved. The token is available only to requests at its allowed origin.",
                );
              });
            }}
          >
            <div className="bot-fields">
              <label>
                Connection name
                <input
                  required
                  pattern="[a-z][a-z0-9_-]{0,63}"
                  value={secret.name}
                  onChange={(e) =>
                    setSecret({ ...secret, name: e.target.value })
                  }
                />
              </label>
              <label>
                Allowed HTTPS origin
                <input
                  required
                  type="url"
                  placeholder="https://api.example.com"
                  value={secret.origin}
                  onChange={(e) =>
                    setSecret({ ...secret, origin: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="bot-fields">
              <label>
                Header
                <select
                  value={secret.header}
                  onChange={(e) =>
                    setSecret({ ...secret, header: e.target.value })
                  }
                >
                  <option>Authorization</option>
                  <option>X-API-Key</option>
                  <option>api-key</option>
                </select>
              </label>
              <label>
                Authentication
                <select
                  value={secret.prefix}
                  onChange={(e) =>
                    setSecret({ ...secret, prefix: e.target.value })
                  }
                >
                  <option value="Bearer ">Bearer token</option>
                  <option value="">Raw API key</option>
                  <option value="Basic ">Basic (encoded credentials)</option>
                </select>
              </label>
            </div>
            <label>
              Token or key
              <input
                required
                type="password"
                autoComplete="off"
                value={secret.value}
                onChange={(e) =>
                  setSecret({ ...secret, value: e.target.value })
                }
              />
            </label>
            <p className="muted">
              Microsoft 365 requires an authorized Graph access token with the
              mail/calendar scopes you need. Tokens may expire; replace them
              here. Automatic OAuth sign-in is not included.
            </p>
            <button className="primary" disabled={busy}>
              Save encrypted connection
            </button>
          </form>
          {data.secrets.map((s: any) => (
            <article className="job-card" key={s.id}>
              <KeyRound size={18} />
              <div>
                <strong>{s.name}</strong>
                <p>{s.origin} · Configured</p>
              </div>
              <button
                aria-label={"Delete connection " + s.name}
                onClick={() => remove(s.id, "secrets.remove")}
              >
                {confirm === s.id ? "Confirm" : <Trash2 size={15} />}
              </button>
            </article>
          ))}
        </>
      )}
      {tab === "toolkit" && (
        <>
          <h2>Tools for the whole task.</h2>
          <p className="muted">
            The same toolkit is available in coding conversations and NightBots.
            Permissions and model capabilities still apply.
          </p>
          <div className="toolkit-grid">
            {capabilities.map(([name, description, status]) => (
              <article key={name}>
                <div>
                  <Check size={16} />
                  <small>{status}</small>
                </div>
                <h3>{name}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
