import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Plus,
  X,
  Globe,
  Loader2,
} from "lucide-react";
const api = window.nightcode;
type Tab = {
  id: string;
  title: string;
  url: string;
  loading: boolean;
  error?: string;
  back: boolean;
  forward: boolean;
};
export function BrowserPanel({
  scope,
  obscured,
  onClose,
}: {
  scope: string;
  obscured: boolean;
  onClose: () => void;
}) {
  const [tabs, setTabs] = useState<Tab[]>([]),
    [selected, setSelected] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const host = useRef<HTMLDivElement>(null),
    selectedRef = useRef("");
  selectedRef.current = selected;
  const current = tabs.find((t) => t.id === selected);
  async function act(fn: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try {
        const next = await api.invoke<Tab[]>("browser.list", { scope });
        if (!live) return;
        setTabs(next);
        setSelected((id) =>
          next.some((t) => t.id === id) ? id : next.at(-1)?.id || "",
        );
      } catch (e: any) {
        if (live) setError(e.message);
      }
    };
    setTabs([]);
    setSelected("");
    void refresh();
    const off = api.onEvent((e) => {
      if (e.type === "browser") void refresh();
      if (e.type === "browser-open" && e.data.scope === scope) {
        setSelected(e.data.id);
        void refresh();
      }
      if (e.type === "menu-closed") setRevision((r) => r + 1);
    });
    return () => {
      live = false;
      off();
      void api.invoke("browser.hide", { scope }).catch(() => {});
    };
  }, [scope]);
  useEffect(() => {
    setUrl(current?.url || "");
  }, [current?.url, selected]);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        void api
          .invoke("browser.show", {
            scope,
            id: selected,
            visible: !!selected && !obscured,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          })
          .catch(() => {});
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [scope, selected, obscured, revision]);
  function normalize(value: string) {
    const v = value.trim();
    return /^https?:\/\//i.test(v)
      ? v
      : !v.includes(" ") && v.includes(".")
        ? "https://" + v
        : "https://www.google.com/search?q=" + encodeURIComponent(v);
  }
  return (
    <aside className="browser-panel" aria-label="Built-in browser">
      <div className="browser-top">
        <span>
          <Globe size={16} /> Browser <small>Isolated from your files</small>
        </span>
        <button aria-label="Close browser" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="browser-tabs" role="tablist" aria-label="Browser tabs">
        {tabs.map((t) => (
          <div key={t.id} className={selected === t.id ? "selected" : ""}>
            <button
              role="tab"
              aria-selected={selected === t.id}
              onClick={() => setSelected(t.id)}
            >
              {t.loading ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <Globe size={13} />
              )}
              <span>{t.title || "New tab"}</span>
            </button>
            <button
              aria-label={"Close tab " + t.title}
              onClick={() =>
                void act(() => api.invoke("browser.close", { scope, id: t.id }))
              }
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          aria-label="New browser tab"
          onClick={() =>
            void act(async () => {
              const t = await api.invoke<Tab>("browser.open", {
                scope,
                url: "https://www.google.com",
              });
              setSelected(t.id);
            })
          }
        >
          <Plus size={15} />
        </button>
      </div>
      <form
        className="browser-address"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            if (selected)
              await api.invoke("browser.navigate", {
                scope,
                id: selected,
                url: normalize(url),
              });
            else {
              const t = await api.invoke<Tab>("browser.open", {
                scope,
                url: normalize(url),
              });
              setSelected(t.id);
            }
          });
        }}
      >
        <button
          type="button"
          aria-label="Browser back"
          disabled={!current?.back}
          onClick={() =>
            void act(() =>
              api.invoke("browser.history", {
                scope,
                id: selected,
                action: "back",
              }),
            )
          }
        >
          <ArrowLeft size={15} />
        </button>
        <button
          type="button"
          aria-label="Browser forward"
          disabled={!current?.forward}
          onClick={() =>
            void act(() =>
              api.invoke("browser.history", {
                scope,
                id: selected,
                action: "forward",
              }),
            )
          }
        >
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          aria-label="Reload page"
          disabled={!selected}
          onClick={() =>
            void act(() =>
              api.invoke("browser.history", {
                scope,
                id: selected,
                action: "reload",
              }),
            )
          }
        >
          <RotateCw size={15} />
        </button>
        <input
          aria-label="Browser address"
          placeholder="Search the web or enter a URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button disabled={busy || !url.trim()} type="submit">
          Go
        </button>
      </form>
      {(error || current?.error) && (
        <div className="browser-error" role="alert">
          {error || current?.error}
        </div>
      )}
      <div className="browser-viewport" ref={host}>
        {!current && (
          <div className="browser-empty">
            <Globe size={38} />
            <h3>A browser for the work.</h3>
            <p>
              Open a website above. Agents can read pages and navigate here
              while you follow along.
            </p>
            <small>
              Enter passwords yourself. Websites cannot access NightCode’s local
              tools.
            </small>
          </div>
        )}
      </div>
    </aside>
  );
}
