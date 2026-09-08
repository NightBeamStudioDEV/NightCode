import { z } from "zod";
import crypto from "node:crypto";
import type { UserQuestion } from "../src/shared";
export const questionSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  context: z.string().max(2000).default(""),
  options: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
});
export class QuestionQueue {
  private pending = new Map<
    string,
    {
      question: UserQuestion;
      resolve: (value: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(private changed: () => void) {}
  list() {
    return [...this.pending.values()].map((item) => item.question);
  }
  ask(sessionId: string, input: unknown, agentId?: string) {
    const data = questionSchema.parse(input);
    if (this.list().some((question) => question.sessionId === sessionId))
      throw new Error(
        "A question is already waiting for this user. Wait for the reply.",
      );
    const question: UserQuestion = {
      ...data,
      agentId,
      id: crypto.randomUUID(),
      sessionId,
    };
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => {
          this.pending.delete(question.id);
          resolve({
            status: "cancelled",
            reason:
              "Question expired without an answer. Do not assume consent.",
          });
          this.changed();
        },
        60 * 60 * 1000,
      );
      this.pending.set(question.id, { question, resolve, timer });
      this.changed();
    });
  }
  reply(id: string, answer: string, sessionId?: string) {
    const item = this.pending.get(id);
    if (!item)
      throw new Error("This question is no longer waiting for an answer.");
    if (sessionId && item.question.sessionId !== sessionId)
      throw new Error("Question belongs to another task.");
    const text = z.string().trim().min(1).max(6000).parse(answer);
    clearTimeout(item.timer);
    this.pending.delete(id);
    item.resolve({ status: "answered", answer: text });
    this.changed();
  }
  cancelAll() {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.resolve({
        status: "cancelled",
        reason: "Task interrupted. No answer was provided.",
      });
    }
    this.pending.clear();
    this.changed();
  }
  cancelAgent(agentId: string) {
    for (const [id, item] of this.pending) {
      if (item.question.agentId !== agentId) continue;
      clearTimeout(item.timer);
      item.resolve({
        status: "cancelled",
        reason: "Subagent stopped. No answer was provided.",
      });
      this.pending.delete(id);
    }
    this.changed();
  }
}
