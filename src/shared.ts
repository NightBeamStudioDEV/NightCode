export type Mode =
  "Default Mode" | "Plan" | "Code" | "Debug" | "Research" | "Agent";
export type PermissionMode = "ask" | "auto" | "full";
export type Theme = "dark" | "light";
export interface CustomModel {
  id: string;
  name: string;
  reasoning?: boolean;
  image?: boolean;
  variants?: Record<string, Record<string, unknown>>;
}
export interface Project {
  id: string;
  name: string;
  path: string;
  roots?: string[];
}
export interface Subagent {
  id: string;
  parentId: string;
  title: string;
  role: "explore" | "code";
  status: "starting" | "running" | "complete" | "error" | "stopped";
  result?: string;
  progress?: string;
}
export interface Session {
  botId?: string;
  permissionMode?: PermissionMode;
  reasoning?: string;
  id: string;
  title: string;
  projectId: string;
  updated: number;
  pinned?: boolean;
  archived?: boolean;
}
export interface Provider {
  models?: CustomModel[];
  id: string;
  name: string;
  model: string;
  baseURL?: string;
  connected: boolean;
}
export interface Attachment {
  path: string;
  name: string;
  kind: "file" | "folder" | "image";
}
export interface Message {
  id: string;
  role: string;
  time?: { created: number; completed?: number };
  tokens?: { output: number; reasoning?: number };
  parts: {
    time?: { start: number; end?: number };
    type: string;
    text?: string;
    tool?: string;
    state?: {
      status: string;
      input?: unknown;
      output?: string;
      error?: string;
    };
  }[];
}
export interface Approval {
  agentId?: string;
  id: string;
  sessionId: string;
  kind: "edit" | "command" | "access" | "action";
  path?: string;
  before?: string | null;
  after?: string | null;
  command?: string;
  cwd?: string;
  status: string;
}
export interface CommandResult {
  sessionId?: string;
  background?: boolean;
  timedOut?: boolean;
  started?: number;
  completed?: number;
  changedFiles?: string[];
  changesLimited?: boolean;
  id: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  running: boolean;
}
export interface Goal {
  objective: string;
  status: "active" | "complete" | "blocked";
  criteria: string[];
  evidence: string;
  updated: number;
}
export interface UserQuestion {
  agentId?: string;
  id: string;
  sessionId: string;
  question: string;
  context: string;
  options: string[];
}
export interface Snapshot {
  tasks?: WorkTask[];
  subagents?: Subagent[];
  questions?: UserQuestion[];
  goals?: Record<string, Goal>;
  queue?: { id: string; sessionId: string; text: string; error?: string }[];
  queuePaused?: boolean;
  progress?: Record<
    string,
    { label: string; status: "pending" | "running" | "complete" }[]
  >;
  preferences?: {
    sidebar?: boolean;
    mode?: Mode;
    providerId?: string;
    modelId?: string;
    projectId?: string;
    permissionMode?: PermissionMode;
    reasoning?: string;
    theme?: Theme;
  };
  activeSessionId?: string;
  projects: Project[];
  sessions: Session[];
  providers: Provider[];
  approvals: Approval[];
  commands: CommandResult[];
  engine: string;
  drafts: Record<string, string>;
}
export interface WorkCheck {
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
  note?: string;
  id: string;
  revision: number;
  criteria: number[];
  commandId: string;
  command: string;
  passed: boolean;
  stale: boolean;
  inputs: Record<string, string>;
  output: string;
  timestamp: number;
}
export interface WorkTask {
  id: string;
  sessionId: string;
  title: string;
  criteria: string[];
  dependsOn: string[];
  revision: number;
  status: "pending" | "running" | "blocked" | "review" | "complete";
  assessment: string;
  checks: WorkCheck[];
  updated: number;
}
export interface NightCodeAPI {
  invoke<T = any>(action: string, data?: unknown): Promise<T>;
  onEvent(cb: (event: { type: string; data?: any }) => void): () => void;
  filePath(file: File): string;
}
declare global {
  interface Window {
    nightcode: NightCodeAPI;
  }
}
