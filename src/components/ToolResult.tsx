import { diffLines } from "diff";
import type { Part } from "../activity";

function decode(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function ReadableResult({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  const parsed = decode(value);
  if (parsed == null || parsed === "") return null;
  if (typeof parsed !== "object") return <pre>{String(parsed)}</pre>;
  if (depth > 5) return <pre>{JSON.stringify(parsed, null, 2)}</pre>;
  if (Array.isArray(parsed))
    return (
      <div className="result-list">
        {parsed.map((item, i) => (
          <ReadableResult key={i} value={item} depth={depth + 1} />
        ))}
      </div>
    );
  const data = parsed as Record<string, unknown>;
  // Command envelopes contain transport metadata, including encoded launchers.
  // Show their actual result; preserve the envelope in the optional details below.
  if (
    "exitCode" in data ||
    "stdout" in data ||
    ("command" in data && "started" in data)
  ) {
    return (
      <div className="command-result">
        <div className="result-meta">
          {data.exitCode != null
            ? `Exit code ${data.exitCode}`
            : data.background
              ? "Running in background"
              : "Command started"}
          {typeof data.durationMs === "number"
            ? ` · ${(data.durationMs / 1000).toFixed(1)}s`
            : ""}
        </div>
        <ReadableResult value={data.output ?? data.stdout} depth={depth + 1} />
        {Boolean(data.stderr) && (
          <ReadableResult value={data.stderr} depth={depth + 1} />
        )}
        {data.exitCode != null &&
          !(data.output || data.stdout || data.stderr) && (
            <p className="muted">Command finished without console output.</p>
          )}
      </div>
    );
  }
  if (Array.isArray(data.content))
    return (
      <ReadableResult
        value={data.content.map((item: any) => item.text ?? item)}
        depth={depth + 1}
      />
    );
  return (
    <dl className="result-fields">
      {Object.entries(data).map(([key, item]) => (
        <div key={key}>
          <dt>
            {key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")}
          </dt>
          <dd>
            <ReadableResult value={item} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function ToolResult({ part }: { part: Part }) {
  const input = (part.state?.input || {}) as Record<string, unknown>;
  const before = input.oldText ?? input.old_string ?? input.before;
  const after = input.newText ?? input.new_string ?? input.after;
  const code = input.code ?? input.command ?? input.content;
  return (
    <>
      {typeof before === "string" && typeof after === "string" ? (
        <div className="tool-diff" aria-label="Code changes">
          <pre>
            {diffLines(before, after).map((chunk, i) => (
              <span
                key={i}
                className={
                  chunk.added
                    ? "diff-added"
                    : chunk.removed
                      ? "diff-removed"
                      : "diff-context"
                }
              >
                {chunk.value
                  .split(/(?<=\n)/)
                  .map(
                    (line) =>
                      `${chunk.added ? "+" : chunk.removed ? "−" : " "} ${line}`,
                  )
                  .join("")}
              </span>
            ))}
          </pre>
        </div>
      ) : typeof code === "string" ? (
        <div className="tool-code">
          <span className="result-meta">
            {String(input.language || (input.command ? "Command" : "Code"))}
          </span>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      ) : null}
      {part.state?.output && (
        <div className="tool-result">
          <ReadableResult value={part.state.output} />
        </div>
      )}
      <details className="technical-details">
        <summary>Technical details</summary>
        <pre>
          {JSON.stringify(
            {
              input: Object.fromEntries(
                Object.entries(input).filter(
                  ([key]) => key !== "__nightcodeRoute",
                ),
              ),
              result: decode(part.state?.output),
            },
            null,
            2,
          )}
        </pre>
      </details>
    </>
  );
}
