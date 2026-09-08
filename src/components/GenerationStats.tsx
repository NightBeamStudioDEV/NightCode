import { useEffect, useState } from "react";
import type { Message } from "../shared";
import { generationMetrics } from "../metrics";
export function GenerationStats({
  messages,
  running,
}: {
  messages: Message[];
  running: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [running, messages]);
  const stats = generationMetrics(messages, now);
  if (!running && !stats.characters && !stats.tokens) return null;
  return (
    <div
      className="generation-stats"
      aria-label="Generation speed"
      title="Live token counts estimate visible answer and provider reasoning text at roughly 4 characters per token. Completed output counts use provider usage when available. Rate uses text-generation intervals, excluding tool waits when timestamps are available. Tokenization differs by model."
    >
      <strong>
        {stats.rate === null
          ? "—"
          : `${stats.reported ? "" : "≈"}${stats.rate.toFixed(1)}`}{" "}
        <span>tok/s</span>
      </strong>
      <span>
        {stats.reported ? "" : "≈"}
        {Math.round(stats.tokens).toLocaleString()}{" "}
        {stats.reported ? "output tokens" : "tokens"}
      </span>
      <small>
        {stats.reported ? "Provider usage" : "Estimated · live text"}
        {stats.reported && stats.reasoning > 0
          ? ` · ${stats.reasoning.toLocaleString()} reasoning tokens reported`
          : ""}
      </small>
    </div>
  );
}
