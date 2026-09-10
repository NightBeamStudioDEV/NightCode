// DeepSeek documents low/high/max for its V4 thinking models. Keep explicit
// provider overrides (including disabled variants) authoritative.
export function modelVariants(
  id: string,
  variants: Record<string, Record<string, unknown>> = {},
) {
  const defaults = /(?:^|\/)deepseek-v4-(?:flash|pro)(?:-|$)/i.test(id)
    ? Object.fromEntries(
        ["low", "high", "max"].map((effort) => [
          effort,
          { reasoningEffort: effort },
        ]),
      )
    : {};
  return { ...defaults, ...variants };
}
