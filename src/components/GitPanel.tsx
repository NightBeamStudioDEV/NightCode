import { useEffect, useState } from "react";
import { GitBranch, RotateCw, X } from "lucide-react";
export function GitPanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<any>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [branch, setBranch] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [remote, setRemote] = useState("");
  const [output, setOutput] = useState("");
  const refresh = async () => {
    const value = await window.nightcode.invoke<any>("git.status", {
      projectId,
    });
    setState(value);
    setRemote((r) =>
      value.remotes?.includes(r) ? r : value.remotes?.[0] || "",
    );
  };
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [projectId]);
  async function run(action: string, extra = {}) {
    setBusy(true);
    setError("");
    setOutput("");
    try {
      if (action === "refresh") await refresh();
      else {
        const result = await window.nightcode.invoke<string>("git.action", {
          projectId,
          action,
          message,
          branch,
          remote,
          ...extra,
        });
        setOutput(
          result ||
            (action === "diff" || action === "compare"
              ? "No tracked changes."
              : "Done."),
        );
        await refresh();
      }
    } catch (e: any) {
      setError(e.message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="tasks-popover git-panel" aria-label="Repository">
      <div className="tasks-panel-heading">
        <strong>
          <GitBranch /> Repository
        </strong>
        <button
          aria-label="Refresh repository"
          disabled={busy}
          onClick={() => void run("refresh")}
        >
          <RotateCw />
        </button>
        <button aria-label="Close repository" onClick={onClose}>
          <X />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!state ? (
        <p>Loading repository…</p>
      ) : !state.repository ? (
        <p>This project is not a Git repository.</p>
      ) : (
        <>
          <button
            className="git-row"
            disabled={busy}
            onClick={() => void run("diff")}
          >
            Changes{" "}
            <span className="git-count">
              +{state.added} −{state.removed}
            </span>
          </button>
          <small>Tracked line changes; new files are listed below.</small>
          <div className="git-files">
            {state.changes.map((c: any) => (
              <div key={c.path}>
                <code>{c.status}</code>
                <span>{c.path}</span>
              </div>
            ))}
          </div>
          <p className="git-current">
            <GitBranch /> {state.branch || "Detached HEAD"}{" "}
            {state.upstream && <small>→ {state.upstream}</small>}
          </p>
          <label>
            Branch
            <select
              aria-label="Repository branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">Choose branch…</option>
              {state.branches.map((b: string) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <div className="git-actions">
            <button
              disabled={busy || !branch}
              onClick={() => void run("switch")}
            >
              Switch branch
            </button>
            <button
              disabled={busy || !branch}
              onClick={() => void run("compare")}
            >
              Compare branch
            </button>
          </div>
          <div className="git-actions">
            <input
              aria-label="New branch name"
              placeholder="New branch name"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
            />
            <button
              disabled={busy || !newBranch}
              onClick={() => void run("create", { branch: newBranch })}
            >
              Create branch
            </button>
          </div>
          <label>
            Commit message
            <textarea
              aria-label="Commit message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <small>
            Commit includes staged changes. Stage all includes new, modified,
            and deleted files in this project.
          </small>
          <label>
            Remote
            <select
              aria-label="Git remote"
              value={remote}
              onChange={(e) => setRemote(e.target.value)}
            >
              <option value="">No remote</option>
              {state.remotes.map((r: string) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="git-actions">
            <button
              disabled={busy || !state.changes.length}
              onClick={() => void run("stage")}
            >
              Stage all
            </button>
            <button
              disabled={busy || !message.trim()}
              onClick={() => void run("commit")}
            >
              Commit
            </button>
            <button
              disabled={busy || !message.trim() || !remote}
              onClick={() => void run("commit-push")}
            >
              Commit &amp; push
            </button>
            <button disabled={busy || !remote} onClick={() => void run("push")}>
              Push
            </button>
          </div>
        </>
      )}
      {output && (
        <pre className="git-output" role="status">
          {output}
        </pre>
      )}
    </aside>
  );
}
