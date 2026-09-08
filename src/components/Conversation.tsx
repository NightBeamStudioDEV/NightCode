import React, { memo, useEffect, useId, useMemo, useState } from "react";
import {
  ChevronDown,
  Loader2,
  Pencil,
  Terminal,
  Search,
  FileCode2,
  ListPlus,
  X,
  Zap,
} from "lucide-react";
import Markdown from "react-markdown";
import type { Message } from "../shared";
import {
  activitySummary,
  buildFeed,
  effortColors,
  toolInfo,
  type Part,
} from "../activity";

const Prose = memo(function Prose({ text }: { text: string }) {
  return (
    <div className="markdown">
      <Markdown>{text}</Markdown>
    </div>
  );
});
export const ConversationFeed = memo(function ConversationFeed({
  messages,
}: {
  messages: Message[];
}) {
  const items = useMemo(() => buildFeed(messages), [messages]);
  return (
    <>
      {items.map((item) =>
        item.reasoning ? (
          <Disclosure
            key={item.key}
            className="provider-reasoning"
            title={
              item.streaming
                ? "Provider reasoning · streaming"
                : "Provider reasoning"
            }
            icon={item.streaming ? <Loader2 className="spin" /> : <Zap />}
            active={item.streaming}
          >
            <div className="reasoning-prose">
              <small>Reasoning text shared by this provider</small>
              <Prose text={item.text!} />
            </div>
          </Disclosure>
        ) : item.tools ? (
          <ActivityGroup key={item.key} parts={item.tools} />
        ) : (
          <article key={item.key} className={"message " + item.role}>
            <Prose text={item.text!} />
          </article>
        ),
      )}
    </>
  );
});
function Disclosure({
  title,
  icon,
  children,
  active = false,
  className = "",
  failed = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  failed?: boolean;
}) {
  const id = useId();
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? active;
  return (
    <div
      className={`disclosure ${className} ${open ? "is-open" : ""} ${active ? "is-working" : ""} ${failed ? "has-error" : ""}`}
    >
      <button
        className="disclosure-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setChoice(!open)}
        title={title}
      >
        {icon}
        <span>{title}</span>
        <ChevronDown className="disclosure-chevron" />
      </button>
      <div
        className="disclosure-body"
        id={id}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="disclosure-inner">{children}</div>
      </div>
    </div>
  );
}
function ToolIcon({ part }: { part: Part }) {
  const info = toolInfo(part);
  if (info.failed) return <X className="failure-icon" />;
  if (info.active) return <Loader2 className="spin" />;
  const Icon =
    {
      question: ListPlus,
      skill: FileCode2,
      goal: ListPlus,
      inspect: Search,
      edit: Pencil,
      command: Terminal,
      read: FileCode2,
      search: Search,
      plan: ListPlus,
      action: Terminal,
    }[info.kind] || Terminal;
  return <Icon />;
}
function ToolDetail({ part }: { part: Part }) {
  const info = toolInfo(part);
  const title = `${info.label}${info.detail ? ` ${info.detail}` : ""}`;
  return (
    <Disclosure
      className="tool-record"
      title={title}
      icon={<ToolIcon part={part} />}
      failed={info.failed}
    >
      <div className="tool-detail">
        <span className="tool-status">
          {info.failed ? "Failed" : info.active ? "In progress" : "Completed"}
        </span>
        {part.state?.input != null && (
          <>
            <h4>Input</h4>
            <pre>{JSON.stringify(part.state.input, null, 2)}</pre>
          </>
        )}
        {part.state?.output && (
          <>
            <h4>Output</h4>
            <pre>{part.state.output}</pre>
          </>
        )}
        {part.state?.error && (
          <p className="activity-error">{part.state.error}</p>
        )}
      </div>
    </Disclosure>
  );
}
function ActivityGroup({ parts }: { parts: Part[] }) {
  const active = parts.some((p) => toolInfo(p).active);
  const failed = parts.some((p) => toolInfo(p).failed);
  if (parts.length === 1)
    return (
      <div className="activity-single">
        <ToolDetail part={parts[0]} />
      </div>
    );
  return (
    <Disclosure
      className="activity-group"
      title={activitySummary(parts)}
      icon={
        active ? (
          <Loader2 className="spin" />
        ) : failed ? (
          <X className="failure-icon" />
        ) : (
          <ToolIcon part={parts[0]} />
        )
      }
      active={active}
      failed={failed}
    >
      <div className="activity-events">
        {parts.map((part, index) => (
          <ToolDetail key={index} part={part} />
        ))}
      </div>
    </Disclosure>
  );
}
export function LiveActivity({
  messages,
  waiting,
  question = false,
  step,
  rate,
}: {
  messages: Message[];
  waiting: boolean;
  question?: boolean;
  step?: string;
  rate?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  const current = [...messages]
    .reverse()
    .flatMap((m) => [...m.parts].reverse())
    .find((p) => p.type === "tool" && toolInfo(p).active);
  const info = current && toolInfo(current);
  const label = question
    ? "Waiting for your answer"
    : waiting
      ? "Waiting for your review"
      : info
        ? `${info.label}${info.detail ? ` ${info.detail}` : ""}`
        : step || "Working on your request";
  return (
    <div className={"task-progress " + (waiting ? "awaiting-review" : "")}>
      <span className="working-orbit" aria-hidden="true" />
      <span className="live-label" role="status" title={label}>
        {label}
      </span>
      <span className="activity-time">
        {elapsed < 60
          ? `${elapsed}s`
          : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
      </span>
      {!!rate && rate >= 0.5 && (
        <span className="gen-rate">{Math.round(rate)} tok/s</span>
      )}
    </div>
  );
}
export function ReasoningControl({
  model,
  variants,
  value,
  onChange,
}: {
  model: string;
  variants: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, variants.indexOf(value));
  const color = effortColors[value] || "#b58aff";
  const style = { "--effort-color": color } as React.CSSProperties;
  return (
    <div
      className="reasoning-control"
      style={style}
      data-effort={value || "default"}
    >
      <div className="reasoning-heading">
        <Zap />
        <strong title={model}>{model}</strong>
        <span>{value || "Default"}</span>
      </div>
      <div className="reasoning-track">
        <input
          aria-label="Reasoning effort"
          type="range"
          min={0}
          max={Math.max(1, variants.length - 1)}
          step={1}
          disabled={variants.length === 1}
          value={index}
          aria-valuetext={value || "Provider default"}
          onChange={(e) => onChange(variants[Number(e.target.value)] || "")}
        />
        <div className="reasoning-ticks" aria-hidden="true">
          {variants.map((variant, i) => (
            <i key={variant} className={i === index ? "current" : ""} />
          ))}
        </div>
      </div>
      <div className="reasoning-labels">
        {variants.length === 1 ? (
          <small>This model uses its default reasoning.</small>
        ) : (
          variants.map((variant) => (
            <button
              key={variant}
              aria-label={`Set ${variant || "default"} reasoning`}
              aria-pressed={value === variant}
              onClick={() => onChange(variant)}
            >
              {variant || "Default"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
