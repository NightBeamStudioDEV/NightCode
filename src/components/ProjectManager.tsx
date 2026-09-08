import { useState } from "react";
import type { Project } from "../shared";
export function ProjectManager({
  project,
  changed,
  close,
}: {
  project: Project;
  changed: () => Promise<void>;
  close: () => void;
}) {
  const [name, setName] = useState(project.name),
    [roots, setRoots] = useState(project.roots || [project.path]),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="project-manager" aria-label={`Edit ${project.name}`}>
      <div className="manager-toolbar">
        <strong>Project settings</strong>
        <span />
        <button onClick={close}>Close</button>
      </div>
      <label>
        Project name
        <input
          aria-label="Project name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="muted">
        The first folder is the working directory. File tools can access every
        folder listed here. Approved shell commands use your operating-system
        permissions.
      </p>
      <div className="project-roots">
        {roots.map((root, i) => (
          <div key={i}>
            <input
              aria-label={`Project folder ${i + 1}`}
              value={root}
              onChange={(e) =>
                setRoots(roots.map((r, j) => (i === j ? e.target.value : r)))
              }
            />
            <button
              disabled={roots.length === 1}
              onClick={() => setRoots(roots.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="manager-toolbar">
        <button
          disabled={busy || roots.length >= 12}
          onClick={() =>
            void act(async () => {
              const picked = await window.nightcode.invoke<string[]>(
                "projects.pickFolders",
              );
              setRoots([...new Set([...roots, ...picked])].slice(0, 12));
            })
          }
        >
          ＋ Add folders
        </button>
        <span />
        <button
          className="primary"
          disabled={busy || !name.trim()}
          onClick={() =>
            void act(async () => {
              await window.nightcode.invoke("projects.update", {
                id: project.id,
                name,
                roots,
              });
              await changed();
              close();
            })
          }
        >
          Save project
        </button>
      </div>
      <button className="text-button" onClick={() => setConfirm(true)}>
        Remove project
      </button>
      {confirm && (
        <div className="inline-confirm">
          <p>
            Remove this project from the sidebar? Its files and conversations
            will be kept.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await window.nightcode.invoke("projects.remove", {
                  id: project.id,
                });
                await changed();
                close();
              })
            }
          >
            Remove from NightCode
          </button>
          <button onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
    </section>
  );
}
