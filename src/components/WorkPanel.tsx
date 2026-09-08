import { useState } from "react";
import type { WorkTask } from "../shared";
export function WorkPanel({
  tasks,
  sessionId,
}: {
  tasks: WorkTask[];
  sessionId: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!tasks.length) return null;
  return (
    <section className="work-panel" aria-label="Task verification">
      <div className="manager-toolbar">
        <strong>Tasks & checks</strong>
        <small>
          {tasks.filter((t) => t.status === "complete").length}/{tasks.length}{" "}
          complete
        </small>
        <span />
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await window.nightcode.invoke("tasks.audit", { id: sessionId });
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking…" : "Recheck evidence"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {tasks.map((task) => (
        <details key={task.id} className="work-item">
          <summary>
            <span className={`work-status ${task.status}`} />{" "}
            <strong>{task.title}</strong>
            <small>
              {task.status === "review" ? "Needs review" : task.status}
            </small>
          </summary>
          <div className="work-detail">
            <ol>
              {task.criteria.map((criterion, i) => {
                const latest = [...task.checks]
                  .reverse()
                  .find(
                    (c) =>
                      c.revision === task.revision && c.criteria.includes(i),
                  );
                const covered = latest?.passed && !latest.stale;
                return (
                  <li key={i}>
                    <span className={covered ? "check-covered" : "muted"}>
                      {covered ? "✓" : "○"}
                    </span>{" "}
                    {criterion}
                  </li>
                );
              })}
            </ol>
            {task.assessment && <p>{task.assessment}</p>}
            {task.dependsOn.length > 0 && (
              <p className="muted">
                Depends on:{" "}
                {task.dependsOn
                  .map((id) => tasks.find((t) => t.id === id)?.title || id)
                  .join(", ")}
              </p>
            )}
            {task.checks.map((check) => (
              <details className="check-record" key={check.id}>
                <summary>
                  <span>
                    {check.stale || check.revision !== task.revision
                      ? "Outdated"
                      : check.passed
                        ? "Passed"
                        : "Failed"}
                  </span>
                  <code>{check.command}</code>
                </summary>
                <p className="muted">
                  Criteria {check.criteria.map((i) => i + 1).join(", ")} ·{" "}
                  {Object.keys(check.inputs).length} tracked files ·{" "}
                  {new Date(check.timestamp).toLocaleString()}
                </p>
                <pre>
                  {check.note && `${check.note}\n`}
                  {check.exitCode !== undefined &&
                    `Exit code: ${check.exitCode ?? "none"} · ${((check.durationMs || 0) / 1000).toFixed(1)}s\n`}
                  {check.output || "Command produced no output."}
                </pre>
                <details>
                  <summary>Tracked files</summary>
                  {Object.keys(check.inputs).map((file) => (
                    <div className="check-path" key={file}>
                      {file}
                    </div>
                  ))}
                </details>
              </details>
            ))}
            {!task.checks.length && (
              <p className="muted">No checks recorded yet.</p>
            )}
          </div>
        </details>
      ))}
      <small className="muted">
        Checks cover their declared files and criteria. Behavioral and visual
        quality still require assessment.
      </small>
    </section>
  );
}
