import React, { useEffect, useRef, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  Copy,
  FileCode2,
  Folder,
  FolderOpen,
  Maximize2,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Square,
  Terminal,
  Trash2,
  X,
  Loader2,
  RotateCw,
  ShieldCheck,
  ShieldAlert,
  Hand,
  Pencil,
  ListPlus,
  Zap,
  Bot,
  Globe,
  Moon,
  Sun,
  GitBranch,
} from "lucide-react";
import type {
  Approval,
  Attachment,
  CommandResult,
  Message,
  Mode,
  Project,
  Provider,
  Session,
  Snapshot,
  PermissionMode,
  CustomModel,
  Theme,
} from "./shared";
import "@fontsource-variable/inter";
import { diffLines } from "diff";
import "./style.css";
import "./polish.css";
import "./nightbots.css";
import { NightBots } from "./components/NightBots";
import { BrowserPanel } from "./components/BrowserPanel";
import { parseSlash, slashCommands } from "./commands";
import { SkillManager } from "./components/SkillManager";
import { WorkPanel } from "./components/WorkPanel";
import { ProjectManager } from "./components/ProjectManager";
import { SubagentPanel } from "./components/SubagentPanel";
import { QuestionCard } from "./components/QuestionCard";

import { McpSettings } from "./components/McpSettings";
import { toolkitMentions } from "./mentions";
import { ModelPopover } from "./components/ModelPopover";
import brandIcon from "../resources/icon.png";
import { ConversationFeed, ReasoningControl } from "./components/Conversation";
import { unresolvedFailures } from "./activity";
import { GitPanel } from "./components/GitPanel";
import { BotSidebar } from "./components/BotSidebar";
const api = window.nightcode;
const empty: Snapshot = {
  projects: [],
  sessions: [],
  providers: [],
  approvals: [],
  commands: [],
  engine: "Starting engine",
  drafts: {},
};
function sortSessions(list: Session[]) {
  return list
    .slice()
    .sort((a, b) =>
      Boolean(b.pinned) === Boolean(a.pinned)
        ? b.updated - a.updated
        : Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)),
    );
}
function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <img
      className={"brand-mark" + (small ? " small" : "")}
      src={brandIcon}
      alt="NightCode"
      draggable={false}
    />
  );
}
function IconButton({
  label,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      className={"icon-button " + className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function App() {
  const [gitOpen, setGitOpen] = useState(false);
  const [botView, setBotView] = useState(false);
  const [botName, setBotName] = useState("");
  const workspaceSession = useRef<Session | null>(null);
  const workspaceDraft = useRef("");
  const [modelRefreshBusy, setModelRefreshBusy] = useState(false);
  const [quickModel, setQuickModel] = useState({ id: "", name: "" });
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGitOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [mcpMentions, setMcpMentions] = useState<
    { id: string; description: string }[]
  >([]);
  const [modelEfforts, setModelEfforts] = useState("low, medium, high");
  useEffect(() => {
    if (!tasksOpen && !agentsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTasksOpen(false);
        setAgentsOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [tasksOpen, agentsOpen]);
  const [browserOpen, setBrowserOpen] = useState(false),
    [browserScope, setBrowserScope] = useState("workspace"),
    [nativeMenu, setNativeMenu] = useState(false),
    [botsTab, setBotsTab] = useState("bots"),
    [newBotKey, setNewBotKey] = useState(0),
    [theme, setTheme] = useState<Theme>("dark");
  const [snap, setSnap] = useState<Snapshot>(empty),
    [page, setPage] = useState("chat"),
    [sidebar, setSidebar] = useState(true),
    [session, setSession] = useState<Session | null>(null),
    [project, setProject] = useState<Project | null>(null),
    [text, setText] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [mode, setMode] = useState<Mode>("Default Mode"),
    [selected, setSelected] = useState(""),
    [selectedModel, setSelectedModel] = useState(""),
    [permissionMode, setPermissionMode] = useState<PermissionMode>("ask"),
    [reasoning, setReasoning] = useState(""),
    [collapsedProjects, setCollapsedProjects] = useState<string[]>([]),
    [providerStep, setProviderStep] = useState(0),
    [providerSearch, setProviderSearch] = useState(""),
    [modelSearch, setModelSearch] = useState(""),
    [skillList, setSkillList] = useState<{ id: string; description: string }[]>(
      [],
    ),
    [customProvider, setCustomProvider] = useState(false),
    [modelForm, setModelForm] = useState({
      id: "",
      name: "",
      reasoning: false,
      image: false,
    }),
    [providerModels, setProviderModels] = useState<CustomModel[]>([]),
    [queueEdit, setQueueEdit] = useState<{ id: string; text: string } | null>(
      null,
    ),
    [menu, setMenu] = useState(""),
    [modal, setModal] = useState(""),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [activeSessionIds, setActiveSessionIds] = useState<string[]>([]),
    [attachments, setAttachments] = useState<Attachment[]>([]),
    [terminal, setTerminal] = useState(false),
    [viewer, setViewer] = useState(false),
    [approval, setApproval] = useState<Approval | null>(null),
    [command, setCommand] = useState(""),
    [commandResults, setCommandResults] = useState<CommandResult[]>([]),
    [fileList, setFileList] = useState<string[]>([]),
    [file, setFile] = useState<{ name: string; content: string } | null>(null),
    [catalog, setCatalog] = useState<any[]>([]),
    [providerForm, setProviderForm] = useState({
      id: "deepseek",
      name: "DeepSeek",
      model: "deepseek-chat",
      baseURL: "",
      key: "",
    }),
    [projectName, setProjectName] = useState(""),
    [sessionTitle, setSessionTitle] = useState("");
  const sessionRef = useRef(session),
    end = useRef<HTMLDivElement>(null),
    conversationRef = useRef<HTMLDivElement>(null),
    modelButtonRef = useRef<HTMLButtonElement>(null),
    followOutput = useRef(true),
    input = useRef<HTMLTextAreaElement>(null),
    hydrated = useRef(false),
    menuActions = useRef<{
      newChat: () => void;
      openProject: () => void;
      settings: () => void;
      browseFiles: () => void;
    } | null>(null);
  sessionRef.current = session;
  const selectedProvider =
    snap.providers.find((p) => p.id === selected) || snap.providers[0];
  const modelId = selectedModel || selectedProvider?.model || "";
  const modelInfo = catalog
    .find((p) => p.id === selectedProvider?.id)
    ?.models.find((m: any) => m.id === modelId);
  const catalogModels: { id: string; name: string }[] = useMemo(
    () => catalog.find((p) => p.id === selectedProvider?.id)?.models || [],
    [catalog, selectedProvider?.id],
  );
  const running = !!session && activeSessionIds.includes(session.id);
  const unresolvedActionCount = unresolvedFailures(messages).length;
  const taskSessionId = running ? session?.id : undefined;
  const variants: string[] = ["", ...(modelInfo?.variants || [])];
  const reasoningValue = variants.includes(reasoning) ? reasoning : "";
  const modelDisplayName = modelInfo?.name || modelId || "Select model";
  const reasoningDisplay =
    reasoningValue.charAt(0).toUpperCase() + reasoningValue.slice(1);
  const permissionLabels = {
    ask: "Ask for approval",
    auto: "Approve for me",
    full: "Full access",
  };
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const mentionQuery = text.match(/(?:^|\s)@([a-z0-9:-]*)$/)?.[1];
  useEffect(() => {
    if (mentionQuery !== undefined)
      void api
        .invoke<{ id: string; description: string }[]>("skills.list")
        .then(setSkillList)
        .catch(() => {});
  }, [mentionQuery !== undefined, modal]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionOptions = [...skillList, ...toolkitMentions, ...mcpMentions];
  const mentionMatches =
    mentionQuery === undefined
      ? []
      : mentionOptions.filter((s) => s.id.includes(mentionQuery));
  useEffect(() => setMentionIndex(0), [mentionQuery]);
  const refresh = async () => {
    const s = await api.invoke<Snapshot>("snapshot");
    setSnap(s);
    setProject((current) =>
      current ? s.projects.find((p) => p.id === current.id) || null : null,
    );
    setSession((current) =>
      current
        ? s.sessions.find((item) => item.id === current.id) || current
        : null,
    );
    setCommandResults(s.commands);
    setActiveSessionIds(
      s.activeSessionIds || (s.activeSessionId ? [s.activeSessionId] : []),
    );
    return s;
  };
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e: any) {
      setError(
        e.message.replace(/^Error invoking remote method '[^']+': Error: /, ""),
      );
      return undefined;
    }
  };
  const loadMessages = async (id: string) => {
    const raw = await api.invoke<any[]>("session.messages", { id });
    if (sessionRef.current?.id === id)
      setMessages(
        raw.map((m) => ({
          id: m.info.id,
          role: m.info.role,
          parts: m.parts,
          time: m.info.time,
          tokens: m.info.tokens,
        })),
      );
  };
  useEffect(() => {
    void safe(async () => {
      const saved = await refresh();
      const mcps =
        await api.invoke<{ name: string; location: string }[]>("mcp.list");
      setMcpMentions(
        Array.isArray(mcps)
          ? mcps.map((m) => ({ id: `mcp:${m.name}`, description: m.location }))
          : [],
      );
      setText(saved.drafts.new || "");
      if (saved.preferences) {
        const pref = saved.preferences;
        setSidebar(pref.sidebar ?? true);
        setMode(pref.mode ?? "Default Mode");
        setSelected(pref.providerId || "");
        setSelectedModel(pref.modelId || "");
        setPermissionMode(pref.permissionMode || "ask");
        setReasoning(pref.reasoning || "");
        setTheme(pref.theme || "dark");
        setProject(saved.projects.find((p) => p.id === pref.projectId) || null);
      }
      hydrated.current = true;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = api.onEvent((e) => {
      if (e.type === "browser-open") {
        setBrowserScope(e.data.scope);
        setBrowserOpen(true);
      }
      if (e.type === "menu-closed") setNativeMenu(false);
      if (e.type === "bot-run") void safe(refresh);
      if (e.type === "error") setError(String(e.data));
      if (e.type === "progress")
        setSnap((s) => ({
          ...s,
          progress: { ...s.progress, [e.data.sessionId]: e.data.steps },
        }));
      if (e.type === "engine") setSnap((s) => ({ ...s, engine: e.data }));
      if (e.type === "subagents") setSnap((s) => ({ ...s, subagents: e.data }));
      if (e.type === "changed") void safe(refresh);
      if (e.type === "approval") {
        void safe(refresh);
      }
      if (e.type === "menu") {
        if (e.data === "new-chat") menuActions.current?.newChat();
        else if (e.data === "new-bot") {
          setBotView(true);
          setPage("bots");
          setBotsTab("bots");
          setNewBotKey((n) => n + 1);
        } else if (e.data === "bots") {
          setBotView(true);
          setPage("bots");
          setBotsTab("bots");
        } else if (e.data === "connections") {
          setBotView(true);
          setPage("bots");
          setBotsTab("connections");
        } else if (e.data === "open-project")
          menuActions.current?.openProject();
        else if (e.data === "settings") menuActions.current?.settings();
        else if (e.data === "sidebar") setSidebar((s) => !s);
        else if (e.data === "browser") {
          setBrowserScope(sessionRef.current?.id || "workspace");
          setBrowserOpen((b) => !b);
        } else if (e.data === "terminal") setTerminal((t) => !t);
        else if (e.data === "files") menuActions.current?.browseFiles();
        else if (e.data === "theme")
          setTheme((current) => (current === "dark" ? "light" : "dark"));
      }
      if (e.type === "command") {
        setCommandResults((list) => [
          ...list.filter((c) => c.id !== e.data.id),
          e.data,
        ]);
      }
      if (e.type === "task") {
        setActiveSessionIds((ids) =>
          e.data.status === "running"
            ? [...new Set([...ids, e.data.id])]
            : e.data.id
              ? ids.filter((id) => id !== e.data.id)
              : [],
        );
      }
      if (e.type === "messages" || e.type === "reconnect") {
        if (!timer)
          timer = setTimeout(() => {
            timer = undefined;
            const id = sessionRef.current?.id;
            if (id) void safe(() => loadMessages(id));
          }, 120);
      }
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (hydrated.current)
      void api
        .invoke("preferences.save", {
          sidebar,
          mode,
          providerId: selected,
          modelId: selectedModel,
          projectId: project?.id || "",
          permissionMode,
          reasoning: reasoningValue,
          theme,
        })
        .catch(() => {});
  }, [
    sidebar,
    mode,
    selected,
    selectedModel,
    project?.id,
    permissionMode,
    reasoningValue,
    theme,
  ]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (snap.engine === "Ready")
      void safe(async () => setCatalog(await api.invoke("providers.list")));
  }, [snap.engine, snap.providers.length]);
  useEffect(() => {
    if (!followOutput.current) return;
    const frame = requestAnimationFrame(() => {
      const pane = conversationRef.current;
      if (pane) pane.scrollTop = pane.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, snap.progress, running]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".menu-anchor, #model-picker"))
        setMenu("");
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = `${Math.min(180, Math.max(44, input.current.scrollHeight))}px`;
  }, [text]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = setTimeout(() => {
      void api
        .invoke("draft.save", { id: session?.id || "new", text })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [text, session?.id]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const dialog = dialogs[dialogs.length - 1];
      if (e.key === "Tab" && dialog) {
        const targets = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
          ),
        );
        const first = targets[0],
          last = targets[targets.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (e.key === "Escape") {
        setMenu("");
        setModal("");
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        newChat();
      }
      if (
        e.key.toLowerCase() === "k" ||
        (e.shiftKey && e.key.toLowerCase() === "p")
      ) {
        e.preventDefault();
        setModal("search");
        setQuery("");
      }
      if (e.key === "Enter" && !dialog) {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [
    text,
    session,
    project,
    selectedProvider,
    modelId,
    mode,
    running,
    attachments,
  ]);
  function newChat() {
    void api
      .invoke("draft.save", { id: session?.id || "new", text })
      .catch(() => {});
    setSession(null);
    sessionRef.current = null;
    setMessages([]);
    setText("");
    setAttachments([]);
    setPage(botView ? "bots" : "chat");
    setMenu("");
    input.current?.focus();
  }
  async function openSession(s: Session) {
    setBotView(!!s.botId);
    followOutput.current = true;
    await api.invoke("draft.save", { id: session?.id || "new", text });
    setSession(s);
    setProject(snap.projects.find((p) => p.id === s.projectId) || null);
    if (s.botId) {
      const data = await api.invoke<any>("bots.list");
      const bot = data.bots.find((b: any) => b.id === s.botId);
      if (bot) {
        setBotName(bot.name);
        setMode("Default Mode");
        setSelected(bot.providerId);
        setSelectedModel(bot.model);
        setReasoning("");
      }
    }
    sessionRef.current = s;
    setText(snap.drafts[s.id] || "");
    setMessages([]);
    setPage("chat");
    await safe(() => loadMessages(s.id));
  }
  function toggleBotView() {
    if (botView) {
      setBotView(false);
      if (workspaceSession.current) void openSession(workspaceSession.current).then(() => setText(workspaceDraft.current));
      else {
        setSession(null);
        setMessages([]);
        setText(workspaceDraft.current);
        setPage("chat");
      }
    } else {
      workspaceSession.current = session;
      workspaceDraft.current = text;
      setBotView(true);
      const latest = sortSessions(
        snap.sessions.filter((s) => s.botId && !s.archived),
      )[0];
      if (latest) void openSession(latest);
      else {
        setSession(null);
        setMessages([]);
        setText("");
        setPage("bots");
      }
    }
    setTasksOpen(false);
    setAgentsOpen(false);
    setGitOpen(false);
  }
  async function togglePin(s: Session) {
    await safe(() =>
      api.invoke("session.pin", { id: s.id, pinned: !s.pinned }),
    );
    await refresh();
  }
  async function toggleArchive(s: Session) {
    const archived = !s.archived;
    if (archived && session?.id === s.id) newChat();
    await safe(() => api.invoke("session.archive", { id: s.id, archived }));
    await refresh();
  }
  function requestDelete(s: Session) {
    setSession(s);
    sessionRef.current = s;
    setSessionTitle(s.title);
    setModal("delete-conversation");
  }
  async function openProject(create = false) {
    const p = await safe(() =>
      api.invoke<Project | null>(create ? "projects.create" : "projects.open", {
        name: projectName,
      }),
    );
    if (p) {
      setProject(p);
      setModal("");
      setMenu("");
      newChat();
      await refresh();
    }
  }
  async function openSkills() {
    setModal("skills");
    await safe(async () => setSkillList(await api.invoke("skills.list")));
  }
  async function submit() {
    if (!text.trim() || busy) return;
    let command: ReturnType<typeof parseSlash>;
    try {
      command = parseSlash(text);
    } catch (error: any) {
      setError(error.message);
      return;
    }
    if (command.local) {
      setText("");
      if (command.local === "skills") await openSkills();
      else setModal("help");
      return;
    }
    if (command.mode) setMode(command.mode);
    if (!command.text.trim()) {
      setText("");
      setNotice(`${command.mode} mode enabled`);
      return;
    }

    if (!selectedProvider) {
      setModal("settings");
      setNotice("Connect a provider to start your first conversation.");
      return;
    }
    setBusy(true);
    followOutput.current = true;
    const submittedText = text;
    setError("");
    try {
      let s = session;
      if (!s) {
        s = await api.invoke<Session>("session.create", {
          projectId: project?.id || "",
        });
        setSession(s);
        sessionRef.current = s;
      }
      await api.invoke("session.send", {
        id: s.id,
        text,
        providerId: selectedProvider.id,
        model: modelId,
        mode: command.mode || mode,
        attachments,
        enqueue: true,
        permissionMode,
        reasoning: reasoningValue,
      });
      setText((current) => (current === submittedText ? "" : current));
      await api.invoke("draft.save", { id: "new", text: "" });
      setAttachments([]);
      await loadMessages(s.id);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function attach(folder = false) {
    const files = await safe(() =>
      api.invoke<Attachment[]>("attachments.pick", { folder }),
    );
    if (files) setAttachments((a) => [...a, ...files].slice(0, 20));
    setMenu("");
  }
  async function reply(a: Approval, accept: boolean) {
    const result = await safe(async () => {
      await api.invoke("approval.reply", { id: a.id, accept });
      return true;
    });
    if (result) {
      setApproval(null);
      if (a.kind === "edit") setViewer(false);
      await refresh();
      setNotice(accept ? "Approval sent" : "Rejected — no action taken");
    }
  }
  async function browseFiles() {
    setViewer(!viewer);
    setApproval(null);
    if (project) {
      const files = await safe(() =>
        api.invoke<string[]>("files.list", { projectId: project.id }),
      );
      if (files) setFileList(files);
    }
  }
  async function saveProvider() {
    setBusy(true);
    const result = await safe(async () => {
      if (customProvider && !providerForm.baseURL)
        throw new Error("Enter the custom provider base URL");
      await api.invoke("providers.save", {
        ...providerForm,
        models: providerModels,
      });
      await refresh();
      setSelected(providerForm.id);
      setSelectedModel("");
      setCatalog(await api.invoke("providers.list"));
      setProviderForm((f) => ({ ...f, key: "" }));
      setNotice("Provider connected");
      return true;
    });
    setBusy(false);
    if (result) setModal("");
  }
  function settings() {
    setProviderStep(0);
    setProviderSearch("");
    if (selectedProvider) {
      setProviderForm({
        id: selectedProvider.id,
        name: selectedProvider.name,
        model: selectedProvider.model,
        baseURL: selectedProvider.baseURL || "",
        key: "",
      });
      setProviderModels(selectedProvider.models || []);
      setCustomProvider(!!selectedProvider.baseURL);
    }
    setModal("settings");
    setNotice("");
    void safe(async () => setCatalog(await api.invoke("providers.list")));
  }
  function chooseProject(p: Project) {
    const recent = snap.sessions
      .filter((s) => s.projectId === p.id)
      .sort((a, b) => b.updated - a.updated)[0];
    setProject(p);
    if (recent) void openSession(recent);
    else newChat();
    setCollapsedProjects((ids) => ids.filter((id) => id !== p.id));
  }
  function addProvider() {
    setProviderStep(1);
    setCustomProvider(true);
    setProviderModels([]);
    setProviderForm({
      id: "custom-" + crypto.randomUUID().slice(0, 8),
      name: "",
      model: "",
      baseURL: "",
      key: "",
    });
    setModal("settings");
  }
  async function saveModel() {
    await safe(async () => {
      if (!modelForm.id.trim()) throw new Error("Enter a model ID");
      const m: CustomModel = {
        ...modelForm,
        id: modelForm.id.trim(),
        name: modelForm.name.trim() || modelForm.id.trim(),
        ...(modelForm.reasoning
          ? {
              variants: Object.fromEntries(
                modelEfforts
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((effort) => [effort, { reasoningEffort: effort }]),
              ),
            }
          : {}),
      };
      const list = [...providerModels.filter((x) => x.id !== m.id), m];
      setProviderModels(list);
      setProviderForm((f) => ({ ...f, model: m.id }));
      setModal("settings");
    });
  }
  menuActions.current = {
    newChat,
    openProject: () => void openProject(),
    settings,
    browseFiles: () => void browseFiles(),
  };
  const pending = snap.approvals.filter((a) => a.status === "pending");
  return (
    <div
      className={
        "app " +
        (botView ? "bot-view " : "") +
        (!sidebar ? "sidebar-collapsed" : "") +
        (browserOpen ? " browser-visible" : "")
      }
    >
      <aside className="sidebar">
        <div className="sidebar-toolbar">
          <IconButton
            label="Toggle sidebar"
            onClick={() => setSidebar(!sidebar)}
          >
            <PanelLeft />
          </IconButton>
          <IconButton label="Back to welcome" onClick={newChat}>
            <ArrowLeft />
          </IconButton>
          <IconButton
            label="Search · Ctrl+K"
            onClick={() => {
              setModal("search");
              setQuery("");
            }}
          >
            <Search />
          </IconButton>
          <IconButton
            label="Notifications"
            onClick={() => setModal("notifications")}
          >
            <Bell />
            {pending.length > 0 && <i className="notification-dot" />}
          </IconButton>
          <button
            className="bots-view-toggle"
            role="switch"
            aria-label="Bots view"
            aria-checked={botView}
            title="Toggle Bots view"
            onClick={toggleBotView}
          >
            <Bot />
            <span />
          </button>
        </div>
        <div className="sidebar-content">
          <nav>
            <button
              className="nav-item new-chat"
              onClick={newChat}
              aria-label="New Chat"
            >
              <Pencil className="new-chat-icon" />
              New Chat<kbd>Ctrl N</kbd>
            </button>
            <button
              className="nav-item library-button"
              onClick={() => void openSkills()}
            >
              <FileCode2 />
              Skills &amp; toolkits
            </button>
          </nav>
          {botView ? (
            <BotSidebar
              snapshot={snap}
              selected={session?.id}
              onOpen={(s) => void openSession(s)}
              onManage={() => setPage("bots")}
            />
          ) : (
            <>
              <div className="sidebar-section">
                <div className="section-label section-heading">
                  Projects
                  <IconButton
                    label="Open project"
                    onClick={() => void openProject()}
                  >
                    <Plus />
                  </IconButton>
                </div>
                {snap.projects.map((p) => (
                  <div className="project-group" key={p.id}>
                    <div className="project-group-heading">
                      <IconButton
                        label={
                          (collapsedProjects.includes(p.id)
                            ? "Expand "
                            : "Collapse ") + p.name
                        }
                        onClick={() =>
                          setCollapsedProjects((ids) =>
                            ids.includes(p.id)
                              ? ids.filter((id) => id !== p.id)
                              : [...ids, p.id],
                          )
                        }
                      >
                        <ChevronRight
                          className={
                            !collapsedProjects.includes(p.id) ? "expanded" : ""
                          }
                        />
                      </IconButton>
                      <button
                        className={
                          project?.id === p.id ? "current-project" : ""
                        }
                        onClick={() => chooseProject(p)}
                      >
                        <FolderOpen />
                        {p.name}
                      </button>
                      <IconButton
                        label={"Edit project " + p.name}
                        onClick={() => {
                          setEditingProject(p);
                          setPage("projects");
                        }}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label={"New conversation in " + p.name}
                        onClick={() => {
                          newChat();
                          setProject(p);
                          setCollapsedProjects((ids) =>
                            ids.filter((id) => id !== p.id),
                          );
                        }}
                      >
                        <Plus />
                      </IconButton>
                    </div>
                    {!collapsedProjects.includes(p.id) && (
                      <div className="project-conversations">
                        {sortSessions(
                          snap.sessions.filter(
                            (s) => s.projectId === p.id && !s.archived,
                          ),
                        ).map((s) => (
                          <div
                            key={s.id}
                            title={s.title}
                            className={
                              "convo-row " +
                              (session?.id === s.id ? "selected" : "")
                            }
                          >
                            <button
                              aria-label={s.title}
                              className="convo-title"
                              onClick={() => void openSession(s)}
                            >
                              {activeSessionIds.includes(s.id) ? (
                                <Loader2 className="spin convo-pin" />
                              ) : (
                                s.pinned && <Pin className="convo-pin" />
                              )}
                              <span>{s.title}</span>
                            </button>
                            <span className="convo-actions">
                              <IconButton
                                label={s.pinned ? "Unpin" : "Pin " + s.title}
                                onClick={() => void togglePin(s)}
                              >
                                {s.pinned ? <PinOff /> : <Pin />}
                              </IconButton>
                              <IconButton
                                label={"Archive " + s.title}
                                onClick={() => void toggleArchive(s)}
                              >
                                <Archive />
                              </IconButton>
                              <IconButton
                                label={"Delete " + s.title}
                                onClick={() => requestDelete(s)}
                              >
                                <Trash2 />
                              </IconButton>
                            </span>
                          </div>
                        ))}
                        {!snap.sessions.some(
                          (s) => s.projectId === p.id && !s.archived,
                        ) && (
                          <button
                            className="muted"
                            onClick={() => {
                              newChat();
                              setProject(p);
                            }}
                          >
                            Start a conversation
                          </button>
                        )}
                        {snap.sessions.some(
                          (s) => s.projectId === p.id && s.archived,
                        ) && (
                          <details className="archived-group">
                            <summary>
                              Archived ·{" "}
                              {
                                snap.sessions.filter(
                                  (s) => s.projectId === p.id && s.archived,
                                ).length
                              }
                            </summary>
                            {sortSessions(
                              snap.sessions.filter(
                                (s) => s.projectId === p.id && s.archived,
                              ),
                            ).map((s) => (
                              <div
                                key={s.id}
                                title={s.title}
                                className="convo-row"
                              >
                                <button
                                  aria-label={s.title}
                                  className="convo-title"
                                  onClick={() => void openSession(s)}
                                >
                                  <span>{s.title}</span>
                                </button>
                                <span className="convo-actions">
                                  <IconButton
                                    label={"Unarchive " + s.title}
                                    onClick={() => void toggleArchive(s)}
                                  >
                                    <ArchiveRestore />
                                  </IconButton>
                                  <IconButton
                                    label={"Delete " + s.title}
                                    onClick={() => requestDelete(s)}
                                  >
                                    <Trash2 />
                                  </IconButton>
                                </span>
                              </div>
                            ))}
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  className={
                    "nav-item project-nav " +
                    (page === "projects" ? "selected" : "")
                  }
                  onClick={() => setPage("projects")}
                >
                  <Folder />
                  My Projects
                </button>
              </div>
              <div className="sidebar-section recent">
                <div className="section-label">Recent</div>
                {snap.sessions.filter((s) => !s.projectId && !s.archived)
                  .length === 0 ? (
                  <p className="empty-recent">
                    Your conversations will appear here.
                  </p>
                ) : (
                  sortSessions(
                    snap.sessions.filter((s) => !s.projectId && !s.archived),
                  ).map((s) => (
                    <div
                      key={s.id}
                      title={s.title}
                      className={
                        "convo-row recent-item " +
                        (session?.id === s.id && page === "chat"
                          ? "selected"
                          : "")
                      }
                    >
                      <button
                        className="convo-title"
                        onClick={() => void openSession(s)}
                        aria-label={s.title}
                      >
                        {activeSessionIds.includes(s.id) ? (
                          <Loader2 className="spin convo-pin" />
                        ) : s.pinned ? (
                          <Pin className="convo-pin" />
                        ) : (
                          <span className="bullet">•</span>
                        )}
                        <span>{s.title}</span>
                      </button>
                      <span className="convo-actions">
                        <IconButton
                          label={s.pinned ? "Unpin" : "Pin " + s.title}
                          onClick={() => void togglePin(s)}
                        >
                          {s.pinned ? <PinOff /> : <Pin />}
                        </IconButton>
                        <IconButton
                          label={"Archive " + s.title}
                          onClick={() => void toggleArchive(s)}
                        >
                          <Archive />
                        </IconButton>
                        <IconButton
                          label={"Delete " + s.title}
                          onClick={() => requestDelete(s)}
                        >
                          <Trash2 />
                        </IconButton>
                      </span>
                    </div>
                  ))
                )}
                {snap.sessions.some((s) => !s.projectId && s.archived) && (
                  <details className="archived-group">
                    <summary>
                      Archived ·{" "}
                      {
                        snap.sessions.filter((s) => !s.projectId && s.archived)
                          .length
                      }
                    </summary>
                    {sortSessions(
                      snap.sessions.filter((s) => !s.projectId && s.archived),
                    ).map((s) => (
                      <div key={s.id} title={s.title} className="convo-row">
                        <button
                          className="convo-title"
                          onClick={() => void openSession(s)}
                          aria-label={s.title}
                        >
                          <span>{s.title}</span>
                        </button>
                        <span className="convo-actions">
                          <IconButton
                            label={"Unarchive " + s.title}
                            onClick={() => void toggleArchive(s)}
                          >
                            <ArchiveRestore />
                          </IconButton>
                          <IconButton
                            label={"Delete " + s.title}
                            onClick={() => requestDelete(s)}
                          >
                            <Trash2 />
                          </IconButton>
                        </span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            </>
          )}
        </div>
        <button
          className="identity"
          aria-label="Settings"
          onClick={settings}
          title="Settings"
        >
          <BrandMark small />
          <span>
            <strong>NightCode</strong>
            <small>
              {botView ? "Personal conversations" : "Developer Workspace"} ·
              0.4.0
            </small>
          </span>
          <Settings className="identity-settings" />
        </button>
      </aside>
      <main className="workspace">
        <header className="workspace-toolbar">
          <div>
            <nav className="app-menubar" aria-label="Application menu">
              {["File", "Edit", "View", "Help"].map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setNativeMenu(true);
                    void api
                      .invoke("menu.open", { name })
                      .catch(() => setNativeMenu(false));
                  }}
                >
                  {name}
                </button>
              ))}
            </nav>
            {!sidebar && (
              <IconButton label="Show sidebar" onClick={() => setSidebar(true)}>
                <PanelLeft />
              </IconButton>
            )}
            {session && page === "chat" && (
              <button
                className="task-title"
                title="Conversation options"
                onClick={() => {
                  setSessionTitle(session.title);
                  setModal("conversation");
                }}
              >
                {botView ? botName || "Conversation" : session.title}
                <ChevronDown />
              </button>
            )}
          </div>
          <div className="window-tools">
            {project && page === "chat" && !botView && (
              <button
                className="tasks-toggle"
                aria-label="Repository"
                aria-expanded={gitOpen}
                onClick={() => {
                  setGitOpen(!gitOpen);
                  setTasksOpen(false);
                  setAgentsOpen(false);
                }}
              >
                <GitBranch />
                <span>Repository</span>
              </button>
            )}
            {session &&
              page === "chat" &&
              (!botView ||
                (snap.tasks || []).some((t) => t.sessionId === session.id)) && (
                <button
                  className="tasks-toggle"
                  aria-expanded={tasksOpen}
                  aria-controls="tasks-panel"
                  onClick={() => {
                    setGitOpen(false);
                    setTasksOpen(!tasksOpen);
                  }}
                >
                  <ListPlus />
                  <span>Tasks &amp; checks</span>
                  <small>
                    {
                      (snap.tasks || []).filter(
                        (t) =>
                          t.sessionId === session.id && t.status === "complete",
                      ).length
                    }
                    /
                    {
                      (snap.tasks || []).filter(
                        (t) => t.sessionId === session.id,
                      ).length
                    }
                  </small>
                </button>
              )}
            {session &&
              page === "chat" &&
              (snap.subagents || []).some((a) => a.parentId === session.id) && (
                <button
                  className="tasks-toggle"
                  aria-label="Subagents"
                  aria-expanded={agentsOpen}
                  aria-controls="subagents-panel"
                  onClick={() => setAgentsOpen(!agentsOpen)}
                >
                  <span
                    className={
                      (snap.subagents || []).some(
                        (a) =>
                          a.parentId === session.id &&
                          ["running", "starting"].includes(a.status),
                      )
                        ? "working-orbit"
                        : ""
                    }
                  >
                    <Bot />
                  </span>
                  <span>Subagents</span>
                  <small>
                    {
                      (snap.subagents || []).filter(
                        (a) => a.parentId === session.id,
                      ).length
                    }
                  </small>
                </button>
              )}
            <IconButton
              label="Toggle dark mode"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </IconButton>
            <IconButton
              label="Toggle browser"
              onClick={() => {
                setBrowserScope(session?.id || "workspace");
                setBrowserOpen((b) => !b);
              }}
            >
              <Globe />
            </IconButton>
            <IconButton
              label="Code and diff viewer"
              onClick={() => void browseFiles()}
            >
              <PanelRight />
            </IconButton>
            <IconButton
              label="Toggle terminal"
              onClick={() => setTerminal(!terminal)}
            >
              <PanelBottom />
            </IconButton>
            <span className="toolbar-divider" />
            <IconButton
              label="Minimize window"
              onClick={() => void api.invoke("window.minimize")}
            >
              <Minus />
            </IconButton>
            <IconButton
              label="Maximize window"
              onClick={() => void api.invoke("window.maximize")}
            >
              <Maximize2 />
            </IconButton>
            <IconButton
              label="Close window"
              onClick={() => void api.invoke("window.close")}
            >
              <X />
            </IconButton>
          </div>
        </header>
        {gitOpen && project && (
          <GitPanel
            key={project.id}
            projectId={project.id}
            onClose={() => setGitOpen(false)}
          />
        )}

        {tasksOpen && session && page === "chat" && (
          <>
            <button
              className="tasks-backdrop"
              aria-label="Close tasks and checks"
              onClick={() => setTasksOpen(false)}
            />
            <aside
              id="tasks-panel"
              className="tasks-popover"
              aria-label="Tasks and checks"
            >
              <div className="tasks-panel-heading">
                <span>Conversation progress</span>
                <IconButton
                  label="Close tasks panel"
                  onClick={() => setTasksOpen(false)}
                >
                  <X />
                </IconButton>
              </div>
              <WorkPanel
                key={session.id}
                tasks={(snap.tasks || []).filter(
                  (t) => t.sessionId === session.id,
                )}
                sessionId={session.id}
              />
              {!(snap.tasks || []).some((t) => t.sessionId === session.id) && (
                <p className="muted">No tasks recorded yet.</p>
              )}
              {snap.progress?.[session.id]?.length ? (
                <div className="step-list">
                  {snap.progress[session.id].map((step, i) => (
                    <div key={i}>
                      {step.status === "complete" ? (
                        <Check />
                      ) : step.status === "running" ? (
                        <span className="pulse-dot" />
                      ) : (
                        <span className="step-pending" />
                      )}
                      {step.label}
                    </div>
                  ))}
                </div>
              ) : null}
            </aside>
          </>
        )}
        {agentsOpen && session && page === "chat" && (
          <aside
            id="subagents-panel"
            className={
              "tasks-popover agents-popover " +
              (tasksOpen ? "beside-tasks" : "")
            }
            aria-label="Agent tree"
          >
            <div className="tasks-panel-heading">
              <span>{project?.name || "Conversation"} · Local</span>
              <IconButton
                label="Close subagents panel"
                onClick={() => setAgentsOpen(false)}
              >
                <X />
              </IconButton>
            </div>
            <SubagentPanel
              key={session.id}
              agents={(snap.subagents || []).filter(
                (a) => a.parentId === session.id,
              )}
            />
          </aside>
        )}
        {error && (
          <div role="alert" className="banner error">
            <span>{error}</span>
            <IconButton label="Dismiss error" onClick={() => setError("")}>
              <X />
            </IconButton>
          </div>
        )}
        <div className="work-area">
          <section className={"main-pane " + (session ? "has-session" : "")}>
            {page === "bots" ? (
              <NightBots
                snapshot={snap}
                initialTab={botsTab}
                newBotKey={newBotKey}
                onChat={(s, b) => {
                  if (b) {
                    setSelected(b.providerId);
                    setSelectedModel(b.model);
                    setReasoning("");
                  }
                  void openSession(s);
                }}
              />
            ) : page === "chat" ? (
              <>
                {!session ? (
                  <div className="welcome">
                    <div className="logo-tile">
                      <BrandMark />
                    </div>
                    <h1>Welcome to NightCode Desktop</h1>
                    <p>What would you like to build?</p>
                  </div>
                ) : (
                  <div
                    className="conversation"
                    ref={conversationRef}
                    onScroll={(e) => {
                      const pane = e.currentTarget;
                      followOutput.current =
                        pane.scrollHeight - pane.scrollTop - pane.clientHeight <
                        80;
                    }}
                  >
                    {messages.length === 0 && (
                      <div className="conversation-empty">
                        A fresh start. What are we building?
                      </div>
                    )}
                    {snap.goals?.[session.id] && (
                      <details className="goal-card" open>
                        <summary>
                          <Zap />
                          Goal <span>{snap.goals[session.id].status}</span>
                        </summary>
                        <p>{snap.goals[session.id].objective}</p>
                        {snap.goals[session.id].criteria.length > 0 && (
                          <ul>
                            {snap.goals[session.id].criteria.map(
                              (criterion, i) => (
                                <li key={i}>{criterion}</li>
                              ),
                            )}
                          </ul>
                        )}
                        {snap.goals[session.id].evidence && (
                          <small>{snap.goals[session.id].evidence}</small>
                        )}
                        {snap.goals[session.id].status === "complete" && (
                          <div className="goal-achieved" role="status">
                            <span className="outcome-check">✓</span>
                            <span>
                              Goal achieved.
                              {unresolvedActionCount > 0 && (
                                <small>
                                  {unresolvedActionCount} earlier{" "}
                                  {unresolvedActionCount === 1
                                    ? "action remains"
                                    : "actions remain"}{" "}
                                  in the audit trail.
                                </small>
                              )}
                            </span>
                          </div>
                        )}
                      </details>
                    )}
                    <ConversationFeed
                      messages={messages}
                      goalStatus={snap.goals?.[session.id]?.status}
                    />
                    {(snap.questions || [])
                      .filter((question) => question.sessionId === session.id)
                      .map((question) => (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          onReply={async (answer) => {
                            await api.invoke("question.reply", {
                              id: question.id,
                              answer,
                            });
                            await refresh();
                          }}
                        />
                      ))}
                    <div ref={end} />
                  </div>
                )}
                <div
                  className={
                    "composer-area " + (session ? "in-conversation" : "")
                  }
                >
                  {(snap.queue || []).length > 0 && (
                    <div className="prompt-queue">
                      <div className="queue-heading">
                        <ListPlus />
                        Queued prompts
                        {snap.queuePaused && <small>Paused</small>}
                      </div>
                      {snap.queue!.map((q) => (
                        <div className="queue-item" key={q.id}>
                          <span title={q.text}>{q.text}</span>
                          <IconButton
                            label="Move prompt next"
                            onClick={() =>
                              void safe(() =>
                                api.invoke("queue.update", {
                                  id: q.id,
                                  action: "next",
                                }),
                              )
                            }
                          >
                            <ArrowUp />
                          </IconButton>
                          <button
                            onClick={() =>
                              void safe(() =>
                                api.invoke("queue.update", {
                                  id: q.id,
                                  action: "now",
                                }),
                              )
                            }
                            title="Stop the current task and send this prompt now"
                          >
                            Send now
                          </button>
                          <IconButton
                            label="Edit queued prompt"
                            onClick={() => {
                              setQueueEdit({ id: q.id, text: q.text });
                              setModal("queue-edit");
                            }}
                          >
                            <Pencil />
                          </IconButton>
                          <IconButton
                            label="Remove queued prompt"
                            onClick={() =>
                              void safe(() =>
                                api.invoke("queue.update", {
                                  id: q.id,
                                  action: "remove",
                                }),
                              )
                            }
                          >
                            <Trash2 />
                          </IconButton>
                          {q.error && <small>{q.error}</small>}
                        </div>
                      ))}
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div className="pending-actions">
                      {pending.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setApproval(a);
                            if (a.kind === "edit") setViewer(true);
                          }}
                        >
                          <ShieldAlert />
                          <span>
                            {a.kind === "edit"
                              ? "Review file change"
                              : a.kind === "action"
                                ? "Review action"
                                : a.kind === "command"
                                  ? "Review command"
                                  : "Review external access"}
                          </span>
                          <small>
                            {a.path?.split(/[\\/]/).pop() || a.command}
                          </small>
                          <ChevronRight />
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    className="composer-shell"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("dragging");
                    }}
                    onDragLeave={(e) =>
                      e.currentTarget.classList.remove("dragging")
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("dragging");
                      const paths = Array.from(e.dataTransfer.files).map((f) =>
                        api.filePath(f),
                      );
                      void safe(async () => {
                        const added = await api.invoke<Attachment[]>(
                          "attachments.validate",
                          paths,
                        );
                        setAttachments((a) => [...a, ...added].slice(0, 20));
                      });
                    }}
                  >
                    <div className="composer">
                      {text.startsWith("/") && !text.includes(" ") && (
                        <div
                          className="slash-suggestions"
                          aria-label="Slash commands"
                        >
                          {slashCommands
                            .filter((command) =>
                              command.name.startsWith(
                                text.slice(1).toLowerCase(),
                              ),
                            )
                            .map((command) => (
                              <button
                                key={command.name}
                                onClick={() => {
                                  setText(`/${command.name} `);
                                  input.current?.focus();
                                }}
                              >
                                <strong>/{command.name}</strong>
                                <span>{command.description}</span>
                              </button>
                            ))}
                        </div>
                      )}
                      {mentionQuery !== undefined &&
                        mentionMatches.length > 0 && (
                          <div
                            className="slash-suggestions skill-suggestions"
                            aria-label="Skill and tool mentions"
                          >
                            {mentionMatches.map((skill, index) => (
                              <button
                                className={
                                  index === mentionIndex ? "selected" : ""
                                }
                                key={skill.id}
                                onClick={() => {
                                  setText(
                                    text.replace(
                                      /@[a-z0-9:-]*$/,
                                      `@${skill.id} `,
                                    ),
                                  );
                                  input.current?.focus();
                                }}
                              >
                                <strong>@{skill.id}</strong>
                                <span>{skill.description}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      {mode !== "Default Mode" && (
                        <div className="mode-indicator">
                          <span>
                            {mode === "Plan"
                              ? "Plan · read-only"
                              : `${mode} mode`}
                          </span>
                          <button
                            aria-label="Return to default mode"
                            onClick={() => setMode("Default Mode")}
                          >
                            <X />
                          </button>
                        </div>
                      )}

                      <textarea
                        ref={input}
                        aria-label="Message NightCode"
                        placeholder={
                          botView
                            ? "Message your bot…"
                            : "Ask NightCode to build, fix, or explore…"
                        }
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            !e.nativeEvent.isComposing &&
                            mentionMatches.length &&
                            !e.shiftKey &&
                            ["ArrowDown", "ArrowUp", "Tab", "Enter"].includes(
                              e.key,
                            )
                          ) {
                            e.preventDefault();
                            if (e.key === "ArrowDown" || e.key === "ArrowUp")
                              setMentionIndex(
                                (i) =>
                                  (i +
                                    (e.key === "ArrowDown" ? 1 : -1) +
                                    mentionMatches.length) %
                                  mentionMatches.length,
                              );
                            else
                              setText(
                                text.replace(
                                  /@[a-z0-9:-]*$/,
                                  `@${mentionMatches[mentionIndex % mentionMatches.length].id} `,
                                ),
                              );
                            return;
                          }
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            e.stopPropagation();
                            void submit();
                          }
                        }}
                        rows={1}
                      />
                      {attachments.length > 0 && (
                        <div className="attachments">
                          {attachments.map((a, i) => (
                            <span key={a.path + i}>
                              <Paperclip />
                              {a.name}
                              <button
                                aria-label={"Remove " + a.name}
                                onClick={() =>
                                  setAttachments(
                                    attachments.filter((_, j) => j !== i),
                                  )
                                }
                              >
                                <X />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="composer-controls">
                        <div className="control-group">
                          <div className="menu-anchor">
                            <IconButton
                              label="Add attachment"
                              onClick={() =>
                                setMenu(menu === "attach" ? "" : "attach")
                              }
                            >
                              <Plus />
                            </IconButton>
                            {menu === "attach" && (
                              <div className="dropdown above">
                                <button onClick={() => void attach()}>
                                  <Paperclip />
                                  Attach file or image
                                </button>
                                <button onClick={() => void attach(true)}>
                                  <Folder />
                                  Attach folder
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="menu-anchor">
                            <button
                              className={"permission-pill " + permissionMode}
                              disabled={running}
                              onClick={() =>
                                setMenu(
                                  menu === "permissions" ? "" : "permissions",
                                )
                              }
                            >
                              <ShieldCheck />
                              {permissionLabels[permissionMode]}
                              <ChevronDown />
                            </button>
                            {menu === "permissions" && (
                              <div className="dropdown above permission-menu">
                                <p>How should actions be approved?</p>
                                {(
                                  ["ask", "auto", "full"] as PermissionMode[]
                                ).map((value) => (
                                  <button
                                    key={value}
                                    onClick={() => {
                                      setPermissionMode(value);
                                      setMenu("");
                                    }}
                                  >
                                    {value === "ask" ? (
                                      <Hand />
                                    ) : value === "auto" ? (
                                      <ShieldCheck />
                                    ) : (
                                      <ShieldAlert />
                                    )}
                                    <span>
                                      {permissionLabels[value]}
                                      <small>
                                        {value === "ask"
                                          ? "Review every edit and command"
                                          : value === "auto"
                                            ? "Allow project edits; ask for deletion and most commands"
                                            : "Allow file and command actions without asking"}
                                      </small>
                                    </span>
                                    {permissionMode === value && <Check />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="control-group">
                          <div className="menu-anchor">
                            <button
                              className="select-button model-select"
                              ref={modelButtonRef}
                              aria-label="Conversation model"
                              aria-expanded={menu === "model"}
                              aria-controls="model-picker"
                              onClick={() => {
                                setMenu(menu === "model" ? "" : "model");
                                if (!catalog.length)
                                  void safe(async () =>
                                    setCatalog(
                                      await api.invoke("providers.list"),
                                    ),
                                  );
                              }}
                            >
                              <span className="model-name">
                                {modelDisplayName}
                              </span>
                              {reasoningDisplay && (
                                <span
                                  className="model-reasoning"
                                  data-effort={reasoningValue}
                                >
                                  {reasoningDisplay}
                                </span>
                              )}
                              <ChevronDown />
                            </button>
                            {menu === "model" && (
                              <ModelPopover anchor={modelButtonRef}>
                                <ReasoningControl
                                  model={modelDisplayName}
                                  variants={variants}
                                  value={reasoningValue}
                                  onChange={setReasoning}
                                />
                                <input
                                  className="model-search"
                                  aria-label="Search models"
                                  placeholder="Search models…"
                                  value={modelSearch}
                                  onChange={(e) =>
                                    setModelSearch(e.target.value)
                                  }
                                />
                                <div className="model-section-label">
                                  Provider
                                </div>
                                <select
                                  className="provider-switcher"
                                  aria-label="Choose provider"
                                  value={selectedProvider?.id || ""}
                                  onChange={(e) => {
                                    setSelected(e.target.value);
                                    setSelectedModel("");
                                    setReasoning("");
                                    setModelSearch("");
                                  }}
                                >
                                  {snap.providers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="model-section-label">
                                  <span>
                                    Model · {selectedProvider?.name || "None"}
                                  </span>
                                  <span className="model-actions">
                                    <button
                                      aria-label="Refresh models"
                                      title="Refresh models"
                                      disabled={
                                        modelRefreshBusy || !selectedProvider
                                      }
                                      onClick={() =>
                                        void safe(async () => {
                                          setModelRefreshBusy(true);
                                          try {
                                            setCatalog(
                                              await api.invoke(
                                                "models.refresh",
                                                {
                                                  providerId:
                                                    selectedProvider?.id,
                                                },
                                              ),
                                            );
                                          } finally {
                                            setModelRefreshBusy(false);
                                          }
                                        })
                                      }
                                    >
                                      <RotateCw
                                        className={
                                          modelRefreshBusy ? "spin" : ""
                                        }
                                      />
                                    </button>
                                    <button
                                      aria-label="Add or rename model"
                                      title="Add or rename model"
                                      disabled={!selectedProvider}
                                      onClick={() => {
                                        setQuickModel({
                                          id: modelId,
                                          name: modelDisplayName,
                                        });
                                        setMenu("");
                                        setModal("quick-model");
                                      }}
                                    >
                                      <Plus />
                                    </button>
                                  </span>
                                </div>
                                <div className="model-list">
                                  {catalogModels.filter((m) =>
                                    `${m.name} ${m.id}`
                                      .toLowerCase()
                                      .includes(modelSearch.toLowerCase()),
                                  ).length === 0 && (
                                    <p className="muted model-empty">
                                      {modelSearch
                                        ? "No matching models. Try another name."
                                        : "No models available for this provider yet."}
                                    </p>
                                  )}
                                  {catalogModels
                                    .filter((m) =>
                                      `${m.name} ${m.id}`
                                        .toLowerCase()
                                        .includes(modelSearch.toLowerCase()),
                                    )
                                    .map((m) => (
                                      <button
                                        key={m.id}
                                        onClick={() => {
                                          setSelectedModel(m.id);
                                          setReasoning("");
                                        }}
                                      >
                                        <span>
                                          {m.name}
                                          <small>{m.id}</small>
                                        </span>
                                        {m.id === modelId && <Check />}
                                      </button>
                                    ))}
                                </div>
                                <button
                                  onClick={() => {
                                    setMenu("");
                                    settings();
                                  }}
                                >
                                  <Plus />
                                  Connect a provider
                                </button>
                              </ModelPopover>
                            )}
                          </div>
                          {running && (
                            <IconButton
                              label="Stop task"
                              className="send"
                              onClick={() =>
                                taskSessionId &&
                                void safe(() =>
                                  api.invoke("session.abort", {
                                    id: taskSessionId,
                                  }),
                                )
                              }
                            >
                              <Square size={16} />
                            </IconButton>
                          )}
                          {
                            <IconButton
                              label={
                                running
                                  ? "Queue prompt · Enter"
                                  : "Send message · Enter"
                              }
                              className="send"
                              disabled={!text.trim() || busy}
                              onClick={() => void submit()}
                            >
                              {busy ? (
                                <Loader2 className="spin" />
                              ) : running ? (
                                <ListPlus />
                              ) : (
                                <ArrowUp />
                              )}
                            </IconButton>
                          }
                        </div>
                      </div>
                    </div>
                    <button
                      className="project-context"
                      onClick={() => setModal("projects")}
                    >
                      <Folder />
                      <span>{project?.name || "My Projects"}</span>
                      <ChevronRight />
                    </button>
                  </div>
                </div>
              </>
            ) : page === "projects" ? (
              <div className="content-page">
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h1>My Projects</h1>
                <p>Bring your code. Make room for what’s next.</p>
                <div className="page-actions">
                  <button
                    className="primary"
                    onClick={() => void openProject()}
                  >
                    <FolderOpen />
                    Open a folder
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setModal("create-project")}
                  >
                    <Plus />
                    New project
                  </button>
                </div>
                {editingProject && (
                  <ProjectManager
                    key={editingProject.id}
                    project={editingProject}
                    close={() => setEditingProject(null)}
                    changed={async () => {
                      await refresh();
                    }}
                  />
                )}
                {snap.projects.length ? (
                  snap.projects.map((p) => (
                    <div key={p.id} className="managed-project-card">
                      <button
                        className="project-card"
                        onClick={() => {
                          chooseProject(p);
                        }}
                      >
                        <Folder />
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.path}</small>
                        </span>
                        <ArrowRight />
                      </button>
                      <button
                        className="project-edit"
                        aria-label={`Edit project ${p.name}`}
                        onClick={() => setEditingProject(p)}
                      >
                        <Pencil /> Edit
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <FolderOpen />
                    <h3>Your next project starts here</h3>
                    <p>Open an existing folder or create a new one.</p>
                  </div>
                )}
              </div>
            ) : null}
          </section>
          {viewer && (
            <aside className="viewer">
              <div className="panel-heading">
                <span>
                  <FileCode2 />
                  {approval?.kind === "edit"
                    ? "Review change"
                    : "Project files"}
                </span>
                <IconButton
                  label="Close viewer"
                  onClick={() => setViewer(false)}
                >
                  <X />
                </IconButton>
              </div>
              {approval?.kind === "edit" ? (
                <>
                  <div className="diff-path">
                    {approval.after === null ? (
                      <span className="delete-label">Delete file</span>
                    ) : approval.before === null ? (
                      <span>Create file</span>
                    ) : (
                      <span>Modify file</span>
                    )}
                    <strong>{approval.path}</strong>
                  </div>
                  <Diff
                    before={approval.before ?? ""}
                    after={approval.after ?? ""}
                  />
                  <div className="review-actions">
                    <button
                      className="secondary"
                      onClick={() => void reply(approval, false)}
                    >
                      Reject
                    </button>
                    <button
                      className="primary"
                      onClick={() => void reply(approval, true)}
                    >
                      <Check />
                      Accept change
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {!project ? (
                    <p className="panel-empty">
                      Select a project to browse its files.
                    </p>
                  ) : (
                    <>
                      <select
                        aria-label="Select project file"
                        value={file?.name || ""}
                        onChange={(e) => {
                          const name = e.target.value;
                          void safe(async () =>
                            setFile({
                              name,
                              content:
                                (await api.invoke("files.read", {
                                  projectId: project.id,
                                  path: name,
                                })) || "",
                            }),
                          );
                        }}
                      >
                        <option value="">Choose a file…</option>
                        {fileList.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                      {file ? (
                        <pre className="file-content">{file.content}</pre>
                      ) : (
                        <p className="panel-empty">
                          Open a file to inspect its contents.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </aside>
          )}
          {browserOpen && (
            <BrowserPanel
              scope={browserScope}
              obscured={!!modal || !!approval || !!menu || nativeMenu}
              onClose={() => setBrowserOpen(false)}
            />
          )}
        </div>
        {terminal && (
          <section className="terminal-panel">
            <div className="panel-heading">
              <span>
                <Terminal />
                Terminal
              </span>
              <div>
                <IconButton
                  label="Copy terminal output"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      commandResults
                        .map((c) => `> ${c.command}\n${c.stdout}\n${c.stderr}`)
                        .join("\n"),
                    )
                  }
                >
                  <Copy />
                </IconButton>
                <IconButton
                  label="Close terminal"
                  onClick={() => setTerminal(false)}
                >
                  <X />
                </IconButton>
              </div>
            </div>
            <div className="terminal-output">
              {commandResults.length === 0 ? (
                <span className="muted">Command output will appear here.</span>
              ) : (
                commandResults.map((c) => (
                  <div className="command-output" key={c.id}>
                    <div>
                      <strong>❯ {c.command}</strong>
                      <small>
                        {c.running
                          ? "Running"
                          : `Exit ${c.exitCode ?? "interrupted"}`}
                      </small>
                      {c.running && (
                        <button
                          onClick={() =>
                            void safe(() =>
                              api.invoke("commands.cancel", { id: c.id }),
                            )
                          }
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <pre>{c.stdout}</pre>
                    {c.stderr && <pre className="stderr">{c.stderr}</pre>}
                    {!c.running && (
                      <div className="command-changes">
                        {c.changedFiles?.length
                          ? `Changed files: ${c.changedFiles.join(", ")}`
                          : "No changes detected in non-ignored files."}
                        {c.changesLimited ? " (Partial scan)" : ""}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <form
              className="terminal-input"
              onSubmit={(e) => {
                e.preventDefault();
                if (command.trim() && project) {
                  void safe(() =>
                    api.invoke("commands.run", {
                      command,
                      projectId: project.id,
                    }),
                  );
                  setCommand("");
                }
              }}
            >
              <ChevronRight />
              <input
                aria-label="Terminal command"
                placeholder={
                  project
                    ? "Enter a command for review…"
                    : "Select a project to run commands"
                }
                disabled={!project}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                list="command-history"
              />
              <datalist id="command-history">
                {commandResults.map((c) => (
                  <option key={c.id} value={c.command} />
                ))}
              </datalist>
              <button disabled={!project || !command.trim()} type="submit">
                Run
              </button>
            </form>
          </section>
        )}
      </main>
      {approval && approval.kind !== "edit" && (
        <div className="modal-backdrop">
          <section
            className="modal approval-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review action"
          >
            <span className="eyebrow">YOUR APPROVAL IS REQUIRED</span>
            <h2>
              {approval.kind === "command"
                ? "Run this command?"
                : approval.kind === "action"
                  ? "Allow this action?"
                  : "Allow external access?"}
            </h2>
            {approval.command && <pre>{approval.command}</pre>}
            <p className="path-label">{approval.cwd || approval.path}</p>
            <p>
              {approval.kind === "command"
                ? "This command runs on your computer and may change files."
                : approval.kind === "action"
                  ? "Review the target and details. Approving allows this specific action."
                  : "This location is outside the selected project."}
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => void reply(approval, false)}
              >
                Reject
              </button>
              <button
                className="primary"
                onClick={() => void reply(approval, true)}
              >
                Approve once
              </button>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal("");
          }}
        >
          <section
            className={
              "modal " +
              (modal === "settings"
                ? "settings-modal"
                : modal === "skills"
                  ? "skills-modal"
                  : "")
            }
            role="dialog"
            aria-modal="true"
            aria-label={modal}
          >
            <div className="modal-heading">
              <h2>
                {modal === "skills"
                  ? "Skills & toolkits"
                  : modal === "help"
                    ? "Commands"
                    : modal === "settings"
                      ? "Settings"
                      : modal === "conversation"
                        ? "Conversation options"
                        : modal === "quick-model"
                          ? "Add or rename model"
                          : modal === "add-model"
                            ? "Add custom model"
                            : modal === "queue-edit"
                              ? "Edit queued prompt"
                              : modal === "search"
                                ? "Find your next step"
                                : modal === "notifications"
                                  ? "Activity"
                                  : modal === "create-project"
                                    ? "New project"
                                    : "Project context"}
              </h2>
              <IconButton label="Close dialog" onClick={() => setModal("")}>
                <X />
              </IconButton>
            </div>
            {error && (
              <div className="banner error" role="alert">
                <span>{error}</span>
                <IconButton
                  label="Dismiss dialog error"
                  onClick={() => setError("")}
                >
                  <X />
                </IconButton>
              </div>
            )}
            {modal === "quick-model" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void safe(async () => {
                    setBusy(true);
                    try {
                      setCatalog(
                        await api.invoke("models.save", {
                          providerId: selectedProvider?.id,
                          ...quickModel,
                        }),
                      );
                      await refresh();
                      setSelectedModel(quickModel.id);
                      setModal("");
                    } finally {
                      setBusy(false);
                    }
                  });
                }}
              >
                <p className="muted">
                  Use the provider's exact model ID and any display name you
                  prefer.
                </p>
                <label>
                  Model ID
                  <input
                    required
                    aria-label="Model ID"
                    value={quickModel.id}
                    onChange={(e) =>
                      setQuickModel({ ...quickModel, id: e.target.value })
                    }
                  />
                </label>
                <label>
                  Display name
                  <input
                    required
                    aria-label="Display name"
                    value={quickModel.name}
                    onChange={(e) =>
                      setQuickModel({ ...quickModel, name: e.target.value })
                    }
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Save model
                </button>
              </form>
            ) : modal === "skills" ? (
              <SkillManager />
            ) : modal === "help" ? (
              <div className="command-help">
                {slashCommands.map((command) => (
                  <button
                    key={command.name}
                    onClick={() => {
                      setModal("");
                      setText(`/${command.name} `);
                      input.current?.focus();
                    }}
                  >
                    <strong>/{command.name}</strong>
                    <span>{command.description}</span>
                  </button>
                ))}
              </div>
            ) : modal === "settings" ? (
              <>
                <McpSettings
                  onChange={(items) =>
                    setMcpMentions(
                      items.map((m) => ({
                        id: `mcp:${m.name}`,
                        description: m.location,
                      })),
                    )
                  }
                />
                <div
                  className="setup-steps"
                  aria-label="Connection setup progress"
                >
                  {["Provider", "Connection", "Model"].map((label, i) => (
                    <span
                      key={label}
                      className={
                        providerStep === i
                          ? "active"
                          : providerStep > i
                            ? "complete"
                            : ""
                      }
                    >
                      <b>{providerStep > i ? <Check /> : i + 1}</b>
                      {label}
                    </span>
                  ))}
                </div>
                <div className="setup-page" key={providerStep}>
                  {providerStep === 0 ? (
                    <>
                      <h2>Choose your provider</h2>
                      <p className="muted">
                        Connect the models you like working with.
                      </p>
                      <div className="search-input">
                        <Search />
                        <input
                          autoFocus
                          aria-label="Search providers"
                          placeholder="Search providers…"
                          value={providerSearch}
                          onChange={(e) => setProviderSearch(e.target.value)}
                        />
                      </div>
                      <div className="provider-grid">
                        {Array.from(
                          new Map(
                            [
                              { id: "deepseek", name: "DeepSeek" },
                              { id: "opencode", name: "OpenCode Zen" },
                              ...catalog,
                              ...snap.providers,
                            ].map((p) => [p.id, p]),
                          ).values(),
                        )
                          .filter((p) =>
                            `${p.name} ${p.id}`
                              .toLowerCase()
                              .includes(providerSearch.toLowerCase()),
                          )
                          .map((p) => (
                            <button
                              className="provider-card"
                              key={p.id}
                              onClick={() => {
                                const existing = snap.providers.find(
                                  (entry) => entry.id === p.id,
                                );
                                setCustomProvider(!!existing?.baseURL);
                                setProviderModels(existing?.models || []);
                                setProviderForm({
                                  id: p.id,
                                  name: p.name,
                                  model:
                                    existing?.model ||
                                    (p.id === "deepseek"
                                      ? "deepseek-chat"
                                      : ""),
                                  baseURL: existing?.baseURL || "",
                                  key: "",
                                });
                                setProviderStep(1);
                              }}
                            >
                              <span className="provider-monogram">
                                {p.name.slice(0, 2)}
                              </span>
                              <span>
                                <strong>{p.name}</strong>
                                <small>
                                  {snap.providers.some(
                                    (entry) => entry.id === p.id,
                                  )
                                    ? "Connected · Manage"
                                    : "Connect provider"}
                                </small>
                              </span>
                              <ChevronRight />
                            </button>
                          ))}
                      </div>
                      <button
                        className="custom-provider-card"
                        aria-label="Add custom provider"
                        onClick={addProvider}
                      >
                        <Plus />
                        <span>
                          <strong>Add custom provider</strong>
                          <small>Connect an OpenAI-compatible endpoint</small>
                        </span>
                        <ArrowRight />
                      </button>
                      <div className="engine-status">
                        <span
                          className={
                            snap.engine === "Ready"
                              ? "status-dot"
                              : "status-dot inactive"
                          }
                        />
                        {snap.engine}
                        <button
                          className="text-button"
                          onClick={() =>
                            void safe(() => api.invoke("engine.restart"))
                          }
                        >
                          <RotateCw />
                          Restart
                        </button>
                      </div>
                    </>
                  ) : providerStep === 1 ? (
                    <>
                      <h2>Connect {providerForm.name || "your provider"}</h2>
                      <p className="muted">
                        Your API key stays encrypted on this device.
                      </p>
                      {customProvider && (
                        <>
                          <label>
                            Provider ID
                            <input
                              value={providerForm.id}
                              onChange={(e) =>
                                setProviderForm((f) => ({
                                  ...f,
                                  id: e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9_-]/g, "-"),
                                }))
                              }
                            />
                          </label>
                          <label>
                            Display name
                            <input
                              autoFocus
                              value={providerForm.name}
                              onChange={(e) =>
                                setProviderForm((f) => ({
                                  ...f,
                                  name: e.target.value,
                                }))
                              }
                            />
                          </label>
                        </>
                      )}
                      <label>
                        API key
                        <input
                          autoFocus={!customProvider}
                          type="password"
                          autoComplete="off"
                          placeholder={
                            snap.providers.some((p) => p.id === providerForm.id)
                              ? "Leave blank to keep saved key"
                              : "Enter your API key"
                          }
                          value={providerForm.key}
                          onChange={(e) =>
                            setProviderForm((f) => ({
                              ...f,
                              key: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Base URL{" "}
                        <span className="muted">
                          {customProvider ? "Required" : "Optional"}
                        </span>
                        <input
                          placeholder="https://api.example.com/v1"
                          value={providerForm.baseURL}
                          onChange={(e) =>
                            setProviderForm((f) => ({
                              ...f,
                              baseURL: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="modal-actions">
                        <button
                          className="secondary"
                          onClick={() => setProviderStep(0)}
                        >
                          <ArrowLeft />
                          Back
                        </button>
                        <button
                          className="primary"
                          disabled={
                            !providerForm.id.trim() ||
                            !providerForm.name.trim() ||
                            (customProvider &&
                              !/^https?:\/\//.test(providerForm.baseURL))
                          }
                          onClick={() => setProviderStep(2)}
                        >
                          Choose model
                          <ArrowRight />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2>Choose your default model</h2>
                      <p className="muted">
                        Connected through {providerForm.name}. You can switch
                        models from the composer anytime.
                      </p>
                      <div className="setup-models">
                        {[
                          ...(catalog.find((p) => p.id === providerForm.id)
                            ?.models || []),
                          ...providerModels,
                        ]
                          .filter(
                            (m, i, all) =>
                              all.findIndex((entry) => entry.id === m.id) === i,
                          )
                          .map((m: any) => (
                            <button
                              key={m.id}
                              className={
                                "provider-card " +
                                (providerForm.model === m.id ? "selected" : "")
                              }
                              onClick={() => {
                                setProviderForm((f) => ({
                                  ...f,
                                  model: m.id,
                                }));
                                setProviderModels((current) =>
                                  current.some((entry) => entry.id === m.id)
                                    ? current
                                    : [
                                        ...current,
                                        {
                                          id: m.id,
                                          name: m.name,
                                          ...(m.reasoning !== undefined
                                            ? { reasoning: m.reasoning }
                                            : {}),
                                          ...(m.image !== undefined
                                            ? { image: m.image }
                                            : {}),
                                          ...(Array.isArray(m.variants)
                                            ? {
                                                variants: Object.fromEntries(
                                                  m.variants.map(
                                                    (effort: string) => [
                                                      effort,
                                                      {
                                                        reasoningEffort: effort,
                                                      },
                                                    ],
                                                  ),
                                                ),
                                              }
                                            : m.variants
                                              ? { variants: m.variants }
                                              : {}),
                                        },
                                      ],
                                );
                              }}
                            >
                              <span>
                                <strong>{m.name}</strong>
                                <small>{m.id}</small>
                              </span>
                              {providerForm.model === m.id ? (
                                <Check />
                              ) : (
                                <ChevronRight />
                              )}
                            </button>
                          ))}
                      </div>
                      <label>
                        Model ID
                        <input
                          autoFocus
                          placeholder="Choose above or enter a model ID"
                          value={providerForm.model}
                          onChange={(e) =>
                            setProviderForm((f) => ({
                              ...f,
                              model: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        className="text-button"
                        onClick={() => {
                          setModelForm({
                            id: "",
                            name: "",
                            reasoning: false,
                            image: false,
                          });
                          setModal("add-model");
                        }}
                      >
                        <Plus />
                        Add custom model
                      </button>
                      <p className="settings-note">
                        Selected context is sent to your model provider. No
                        NightCode account or telemetry.
                      </p>
                      <div className="modal-actions">
                        <button
                          className="secondary"
                          onClick={() => setProviderStep(1)}
                        >
                          <ArrowLeft />
                          Back
                        </button>
                        <button
                          className="primary"
                          disabled={busy || !providerForm.model.trim()}
                          onClick={() => void saveProvider()}
                        >
                          {busy ? <Loader2 className="spin" /> : <Check />}Save
                          connection
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {providerStep === 0 && snap.providers.length > 0 && (
                  <div className="connected-list">
                    <h3>Connected providers</h3>
                    {snap.providers.map((p) => (
                      <div key={p.id}>
                        <span>
                          {p.name}
                          <small>{p.model}</small>
                        </span>
                        <IconButton
                          label={"Remove " + p.name}
                          onClick={() =>
                            void safe(async () => {
                              await api.invoke("providers.remove", {
                                id: p.id,
                              });
                              await refresh();
                            })
                          }
                        >
                          <Trash2 />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : modal === "search" ? (
              <>
                <div className="search-input">
                  <Search />
                  <input
                    autoFocus
                    placeholder="Search conversations, projects, or commands…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <kbd>Esc</kbd>
                </div>
                <div className="search-results">
                  {[
                    {
                      label: "New Chat",
                      icon: <Plus />,
                      fn: () => {
                        newChat();
                        setModal("");
                      },
                    },
                    {
                      label: "Open project",
                      icon: <Folder />,
                      fn: () => void openProject(),
                    },
                    { label: "Settings", icon: <Settings />, fn: settings },
                    {
                      label: "Toggle terminal",
                      icon: <Terminal />,
                      fn: () => {
                        setTerminal(!terminal);
                        setModal("");
                      },
                    },
                  ]
                    .filter((c) =>
                      c.label.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <button key={c.label} onClick={c.fn}>
                        {c.icon}
                        {c.label}
                        <small>Command</small>
                      </button>
                    ))}
                  {snap.sessions
                    .filter((s) =>
                      s.title.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((s) => (
                      <button key={s.id} onClick={() => void openSession(s)}>
                        <Command />
                        {s.title}
                        <small>Conversation</small>
                      </button>
                    ))}
                  {snap.projects
                    .filter((p) =>
                      p.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          chooseProject(p);
                          setModal("");
                        }}
                      >
                        <Folder />
                        {p.name}
                        <small>Project</small>
                      </button>
                    ))}
                </div>
              </>
            ) : modal === "notifications" ? (
              <>
                <p className="muted">
                  {pending.length
                    ? "Actions waiting for your review."
                    : "You’re all caught up."}
                </p>
                {pending.map((a) => (
                  <button
                    className="activity-item"
                    key={a.id}
                    onClick={() => {
                      setApproval(a);
                      setViewer(a.kind === "edit");
                      setModal("");
                    }}
                  >
                    {a.kind === "edit" ? <FileCode2 /> : <Terminal />}
                    <span>{a.command || a.path}</span>
                    <ChevronRight />
                  </button>
                ))}
                <div className="engine-status">{snap.engine}</div>
              </>
            ) : modal === "add-model" ? (
              <>
                <p className="muted">
                  Add a model to {providerForm.name || "this provider"}.
                </p>
                <label>
                  Model ID
                  <input
                    autoFocus
                    value={modelForm.id}
                    onChange={(e) =>
                      setModelForm((f) => ({ ...f, id: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Display name
                  <input
                    value={modelForm.name}
                    onChange={(e) =>
                      setModelForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={modelForm.reasoning}
                    onChange={(e) =>
                      setModelForm((f) => ({
                        ...f,
                        reasoning: e.target.checked,
                      }))
                    }
                  />
                  Supports OpenAI-compatible reasoning effort
                </label>
                {modelForm.reasoning && (
                  <label>
                    Supported reasoning levels
                    <input
                      aria-label="Supported reasoning levels"
                      value={modelEfforts}
                      onChange={(e) => setModelEfforts(e.target.value)}
                      placeholder="low, medium, high, xhigh, max"
                    />
                  </label>
                )}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={modelForm.image}
                    onChange={(e) =>
                      setModelForm((f) => ({ ...f, image: e.target.checked }))
                    }
                  />
                  Supports image input
                </label>
                <p className="muted">
                  Enable capabilities only when the endpoint supports them. Save
                  the connection after adding the model.
                </p>
                <button className="primary" onClick={() => void saveModel()}>
                  Add model
                </button>
              </>
            ) : modal === "queue-edit" && queueEdit ? (
              <>
                <label>
                  Queued prompt
                  <textarea
                    className="queue-edit-input"
                    aria-label="Queued prompt"
                    value={queueEdit.text}
                    onChange={(e) =>
                      setQueueEdit({ ...queueEdit, text: e.target.value })
                    }
                  />
                </label>
                <button
                  className="primary"
                  disabled={!queueEdit.text.trim()}
                  onClick={() =>
                    void safe(async () => {
                      await api.invoke("queue.update", {
                        id: queueEdit.id,
                        action: "edit",
                        text: queueEdit.text,
                      });
                      setModal("");
                    })
                  }
                >
                  Save queued prompt
                </button>
              </>
            ) : modal === "conversation" && session ? (
              <>
                <label>
                  Conversation title
                  <input
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    maxLength={120}
                  />
                </label>
                <div className="modal-actions">
                  <button
                    className="secondary"
                    disabled={running}
                    onClick={() => setModal("delete-conversation")}
                  >
                    <Trash2 />
                    Delete conversation
                  </button>
                  <button
                    className="primary"
                    disabled={!sessionTitle.trim()}
                    onClick={() =>
                      void safe(async () => {
                        await api.invoke("session.rename", {
                          id: session.id,
                          title: sessionTitle.trim(),
                        });
                        setSession({ ...session, title: sessionTitle.trim() });
                        await refresh();
                        setModal("");
                      })
                    }
                  >
                    Save title
                  </button>
                </div>
              </>
            ) : modal === "delete-conversation" && session ? (
              <>
                <p>
                  Delete “{session.title}” and its conversation history? This
                  cannot be undone. Project files remain on disk.
                </p>
                <div className="modal-actions">
                  <button
                    className="secondary"
                    onClick={() => setModal("conversation")}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary"
                    onClick={() =>
                      void safe(async () => {
                        await api.invoke("session.delete", { id: session.id });
                        await refresh();
                        newChat();
                        setModal("");
                      })
                    }
                  >
                    Delete permanently
                  </button>
                </div>
              </>
            ) : modal === "create-project" ? (
              <>
                <label>
                  Project name
                  <input
                    autoFocus
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-next-project"
                  />
                </label>
                <p className="muted">
                  Choose the parent folder in the next step.
                </p>
                <button
                  className="primary"
                  disabled={!projectName.trim()}
                  onClick={() => void openProject(true)}
                >
                  Choose location
                  <ArrowRight />
                </button>
              </>
            ) : (
              <>
                <p className="muted">
                  Choose the codebase for your next conversation.
                </p>
                {snap.projects.map((p) => (
                  <button
                    key={p.id}
                    className="project-card"
                    onClick={() => {
                      setProject(p);
                      setModal("");
                    }}
                  >
                    <Folder />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.path}</small>
                    </span>
                    {project?.id === p.id && <Check />}
                  </button>
                ))}
                <button
                  className="secondary"
                  onClick={() => void openProject()}
                >
                  <FolderOpen />
                  Open a folder
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {notice && !modal && (
        <div className="toast" role="status">
          <Check />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X />
          </button>
        </div>
      )}
    </div>
  );
}
function Diff({ before, after }: { before: string; after: string }) {
  const chunks = diffLines(before, after);
  const old: { text: string; number: number | null; changed: boolean }[] = [];
  const next: typeof old = [];
  let oldNumber = 1,
    newNumber = 1;
  const lines = (value: string) => value.replace(/\n$/, "").split("\n");
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.added && !chunk.removed) {
      for (const text of lines(chunk.value)) {
        old.push({ text, number: oldNumber++, changed: false });
        next.push({ text, number: newNumber++, changed: false });
      }
    } else {
      const removed = chunk.removed ? lines(chunk.value) : [];
      const added = chunk.added
        ? lines(chunk.value)
        : chunks[i + 1]?.added
          ? lines(chunks[++i].value)
          : [];
      for (let row = 0; row < Math.max(removed.length, added.length); row++) {
        old.push({
          text: removed[row] ?? "",
          number: row < removed.length ? oldNumber++ : null,
          changed: row < removed.length,
        });
        next.push({
          text: added[row] ?? "",
          number: row < added.length ? newNumber++ : null,
          changed: row < added.length,
        });
      }
    }
  }
  return (
    <div className="diff">
      <div>
        <header>OLD</header>
        <pre>
          {old.map((line, i) => (
            <span className={line.changed ? "removed" : ""} key={i}>
              <em>{line.number}</em>
              {line.text || " "}
              <br />
            </span>
          ))}
        </pre>
      </div>
      <div>
        <header>NEW</header>
        <pre>
          {next.map((line, i) => (
            <span className={line.changed ? "added" : ""} key={i}>
              <em>{line.number}</em>
              {line.text || " "}
              <br />
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
