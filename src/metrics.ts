import type { Message } from "./shared";
export function generationMetrics(messages: Message[], now: number) {
  let lastUser = -1;
  messages.forEach((message, index) => {
    if (message.role === "user") lastUser = index;
  });
  const responses = messages
    .slice(lastUser + 1)
    .filter((message) => message.role === "assistant");
  const textParts = responses
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "text" || part.type === "reasoning");
  const characters = textParts.reduce(
    (sum, part) => sum + (part.text?.length || 0),
    0,
  );
  const complete =
    responses.length > 0 &&
    responses.every((message) => !!message.time?.completed);
  const reported =
    complete &&
    responses.every((message) => Number.isFinite(message.tokens?.output));
  const output = responses.reduce(
    (sum, message) => sum + (message.tokens?.output || 0),
    0,
  );
  const reasoning = responses.reduce(
    (sum, message) => sum + (message.tokens?.reasoning || 0),
    0,
  );
  // Output-token semantics differ across providers, so reasoning usage is shown separately rather than added.
  const tokens = reported ? output : characters / 4;
  const ranges = textParts
    .filter((part) => part.time?.start && (part.text?.length || 0) > 0)
    .map((part) => [part.time!.start, part.time!.end || now])
    .sort((a, b) => a[0] - b[0]);
  let duration = 0,
    start = 0,
    end = 0;
  for (const range of ranges) {
    if (!end) {
      [start, end] = range;
    } else if (range[0] <= end) {
      end = Math.max(end, range[1]);
    } else {
      duration += Math.max(0, end - start);
      [start, end] = range;
    }
  }
  duration += Math.max(0, end - start);
  return {
    tokens,
    reasoning,
    reported,
    characters,
    seconds: duration / 1000,
    rate: duration > 0 ? tokens / (duration / 1000) : null,
  };
}
