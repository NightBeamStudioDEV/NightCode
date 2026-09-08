import { expect, it } from "vitest";
import { QuestionQueue } from "../electron/questions";
import { generationMetrics } from "../src/metrics";
import { buildFeed } from "../src/activity";
it("stopping a subagent only cancels its own question", async () => {
  const queue = new QuestionQueue(() => {});
  const parent = queue.ask("parent", { question: "Parent question" });
  const child = queue.ask(
    "other-parent",
    { question: "Child question" },
    "child",
  );
  queue.cancelAgent("child");
  expect(await child).toMatchObject({ status: "cancelled" });
  expect(queue.list()).toHaveLength(1);
  queue.reply(queue.list()[0].id, "Answer");
  expect(await parent).toMatchObject({ answer: "Answer" });
});
it("questions return explicit answers and reject stale or duplicate replies", async () => {
  const queue = new QuestionQueue(() => {});
  const answer = queue.ask("session", {
    question: "Which view?",
    options: ["First person", "Third person"],
  });
  expect(() => queue.ask("session", { question: "Duplicate" })).toThrow(
    /already/,
  );
  const id = queue.list()[0].id;
  expect(() => queue.reply(id, " ")).toThrow();
  queue.reply(id, "Top-down custom view");
  expect(await answer).toEqual({
    status: "answered",
    answer: "Top-down custom view",
  });
  expect(() => queue.reply(id, "late")).toThrow(/no longer/);
});
it("interrupted questions never imply consent", async () => {
  const queue = new QuestionQueue(() => {});
  const answer = queue.ask("session", { question: "Proceed?" });
  queue.cancelAll();
  expect(await answer).toMatchObject({ status: "cancelled" });
  expect(queue.list()).toHaveLength(0);
});
it("reasoning preserves stream order and is separated from the answer", () => {
  const items = buildFeed([
    {
      id: "a",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Provider summary", time: { start: 1000 } },
        { type: "text", text: "Answer" },
      ],
    },
  ]);
  expect(items[0]).toMatchObject({ reasoning: true, streaming: true });
  expect(items[1].reasoning).toBeUndefined();
});
it("metrics isolate the latest prompt, label estimates and merge overlapping generation intervals", () => {
  const metrics = generationMetrics(
    [
      {
        id: "old",
        role: "assistant",
        parts: [{ type: "text", text: "old output" }],
      },
      { id: "u", role: "user", parts: [] },
      {
        id: "a",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "abcd", time: { start: 1000, end: 2000 } },
          { type: "text", text: "abcd", time: { start: 1500, end: 3000 } },
        ],
      },
    ],
    3000,
  );
  expect(metrics.tokens).toBe(2);
  expect(metrics.seconds).toBe(2);
  expect(metrics.rate).toBe(1);
  expect(metrics.reported).toBe(false);
  const complete = generationMetrics(
    [
      {
        id: "a",
        role: "assistant",
        time: { created: 1000, completed: 3000 },
        tokens: { output: 12, reasoning: 4 },
        parts: [
          { type: "text", text: "answer", time: { start: 1000, end: 3000 } },
        ],
      },
    ],
    9000,
  );
  expect(complete.tokens).toBe(12);
  expect(complete.reasoning).toBe(4);
  expect(complete.rate).toBe(6);
  expect(complete.reported).toBe(true);
});
