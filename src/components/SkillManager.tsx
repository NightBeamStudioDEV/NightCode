import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { toolkitMentions } from "../mentions";
type Skill = { id: string; description: string };
const api = window.nightcode;
export function SkillManager() {
  const [skills, setSkills] = useState<Skill[]>([]),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Skill>(),
    [originalId, setOriginalId] = useState(""),
    [content, setContent] = useState(""),
    [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const refresh = async () => setSkills(await api.invoke("skills.list"));
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="skill-manager">
      {error && <p role="alert">{error}</p>}
      {selected ? (
        <>
          <div className="manager-toolbar">
            <button
              onClick={() => {
                setSelected(undefined);
                setEditing(false);
                setConfirm(false);
              }}
            >
              ← All skills
            </button>
            <span />
            {!editing && (
              <button onClick={() => setEditing(true)}>Edit skill</button>
            )}
          </div>
          {editing ? (
            <form
              className="skill-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  if (!originalId && skills.some((s) => s.id === selected.id))
                    throw new Error(
                      "A skill with this name already exists. Choose another name or edit that skill.",
                    );
                  await api.invoke("skills.save", { ...selected, content });
                  setOriginalId(selected.id);
                  await refresh();
                  setEditing(false);
                });
              }}
            >
              <label>
                Skill name
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={80}
                  disabled={!!originalId}
                  value={selected.id}
                  onChange={(e) =>
                    setSelected({ ...selected, id: e.target.value })
                  }
                  placeholder="my-game-workflow"
                />
              </label>
              <label>
                Description
                <input
                  required
                  maxLength={500}
                  value={selected.description}
                  onChange={(e) =>
                    setSelected({ ...selected, description: e.target.value })
                  }
                />
              </label>
              <label>
                Instructions
                <textarea
                  aria-label="Instructions"
                  required
                  maxLength={60000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Save skill
              </button>
            </form>
          ) : (
            <>
              <div className="skill-reader markdown">
                <Markdown>{content.replace(/^---[\s\S]*?---\s*/, "")}</Markdown>
              </div>
              <div className="manager-toolbar">
                <code>@{selected.id}</code>
                <span />
                <button onClick={() => setConfirm(true)}>Delete skill</button>
              </div>
              {confirm && (
                <div className="inline-confirm">
                  <p>
                    Remove this skill from your library? Existing conversations
                    keep their loaded guidance.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api.invoke("skills.remove", { id: selected.id });
                        await refresh();
                        setSelected(undefined);
                        setConfirm(false);
                      })
                    }
                  >
                    Remove skill
                  </button>
                  <button onClick={() => setConfirm(false)}>Cancel</button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <p className="muted">
            Guidance and tools in one place. Mention <code>@skillname</code> or <code>@toolkit:name</code> in a message to use them.
          </p>
          <div className="manager-toolbar">
            <input
              aria-label="Search skills"
              placeholder="Search skills and toolkits…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="secondary"
              onClick={() => {
                setSelected({ id: "", description: "" });
                setOriginalId("");
                setContent("");
                setEditing(true);
              }}
            >
              ＋ Add skill
            </button>
          </div>
          <div className="skill-grid">
            {skills
              .filter((s) =>
                `${s.id} ${s.description}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((skill) => (
                <button
                  className="provider-card"
                  key={skill.id}
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const text = await api.invoke<string>("skills.load", {
                        id: skill.id,
                      });
                      setContent(text);
                      setSelected(skill);
                      setOriginalId(skill.id);
                    })
                  }
                >
                  <span>
                    <strong>{skill.id.replaceAll("-", " ")}</strong>
                    <small>{skill.description}</small>
                    <code>@{skill.id}</code>
                  </span>
                </button>
              ))}
          </div>
          <div className="toolkit-library">
            {toolkitMentions
              .filter((t) =>
                (t.id + " " + t.description)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((t) => (
                <article key={t.id} className="provider-card">
                  <span>
                    <strong>{t.id.split(":")[1]} toolkit</strong>
                    <small>{t.description}</small>
                    <code>@{t.id}</code>
                  </span>
                </article>
              ))}
          </div>
          {!skills.filter((s) =>
            `${s.id} ${s.description}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          ).length && !toolkitMentions.some((t) => (t.id + " " + t.description).toLowerCase().includes(query.toLowerCase())) && <p className="muted">No matching skills or toolkits.</p>}
        </>
      )}
    </div>
  );
}
