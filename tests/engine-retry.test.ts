import { expect, it, vi } from "vitest";
import { Engine } from "../electron/engine";
it("retries transient reads once but never replays mutations or revives a stopped engine", async () => {
  const engine = new Engine("unused", "unused", () => ({ url: "", token: "" }), () => [], () => {});
  vi.spyOn(engine, "start").mockResolvedValue();
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("terminated")).mockResolvedValueOnce(new Response('{"ok":true}'));
  vi.stubGlobal("fetch", fetcher);
  try {
    expect(await engine.api("/session")).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockReset().mockRejectedValue(new TypeError("terminated"));
    await expect(engine.api("/session", "POST", {})).rejects.toThrow("terminated");
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear(); engine.stop();
    await expect(engine.api("/session")).rejects.toThrow("terminated");
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); vi.restoreAllMocks(); }
});
