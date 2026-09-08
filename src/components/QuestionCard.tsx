import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { UserQuestion } from "../shared";
export function QuestionCard({
  question,
  onReply,
}: {
  question: UserQuestion;
  onReply: (answer: string) => Promise<unknown>;
}) {
  const [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await onReply(answer.trim());
    } catch (error: any) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="question-card" aria-label="Agent question">
      <header>
        <MessageCircle />
        <span>Your input is needed</span>
      </header>
      <h3>{question.question}</h3>
      {question.context && <p>{question.context}</p>}
      <div className="question-options">
        {question.options.map((option, index) => (
          <button
            key={index}
            disabled={busy}
            aria-pressed={answer === option}
            onClick={() => setAnswer(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <label>
        Your answer
        <textarea
          aria-label="Your answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Choose an option or write your own answer…"
          maxLength={6000}
          disabled={busy}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <footer>
        <small>The agent will continue after you reply.</small>
        <button
          className="primary"
          disabled={busy || !answer.trim()}
          onClick={() => void submit()}
        >
          <Send />
          {busy ? "Sending…" : "Send answer"}
        </button>
      </footer>
    </section>
  );
}
