/**
 * HTTP client for the Python FastAPI backend.
 *
 * All memory operations are routed through this client instead of the
 * in-browser MemoryManager, giving us persistent SQLite storage,
 * TF-IDF embeddings, and a shared API surface for any client.
 */

// In dev, Vite proxies /api/* to the Python backend on :8000.
// In production, the frontend and API share the same origin.
const API_BASE = import.meta.env.VITE_PYTHON_API_URL || "";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

import type { MemoryTier } from "../types";

// ---------- Types (mirrors server/schemas.py) --------------------------------

export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  decayRate: number;
  tags: string[];
  metadata: Record<string, unknown>;
  associations: string[];
  consolidated: boolean;
}

export interface MemoryListResponse {
  memories: MemoryEntry[];
  total: number;
}

export interface OperationEntry {
  id: string;
  type: 'create' | 'consolidate' | 'decay' | 'retrieve' | 'associate' | 'prune';
  sourceTier: MemoryTier;
  targetTier: MemoryTier | null;
  memoryId: string;
  timestamp: number;
  details: string;
}

export interface TierCounts {
  sensory: number;
  short_term: number;
  long_term: number;
  episodic: number;
  procedural: number;
}

export interface StatsResponse {
  totalMemories: number;
  tierCounts: TierCounts;
  avgImportance: number;
  consolidationRate: number;
  retrievalAccuracy: number;
  memoryUtilization: number;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  memoriesAccessed: string[];
  memoriesCreated: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: number;
}

export interface SendMessageResponse {
  message: ConversationMessage;
  memoriesAccessed: MemoryEntry[];
  suggestedPrompt: {
    system: string;
    messages: Array<{ role: string; content: string }>;
  };
}

// ---------- Memory API -------------------------------------------------------

export const memories = {
  list: (tier?: string) =>
    request<MemoryListResponse>(
      `/api/memories${tier ? `?tier=${tier}` : ""}`,
    ),

  create: (data: {
    content: string;
    tier?: string;
    importance?: number;
    tags?: string[];
  }) =>
    request<MemoryEntry>("/api/memories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (uid: string) => request<MemoryEntry>(`/api/memories/${uid}`),

  update: (uid: string, data: Record<string, unknown>) =>
    request<MemoryEntry>(`/api/memories/${uid}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (uid: string) =>
    request<void>(`/api/memories/${uid}`, { method: "DELETE" }),

  search: (query: string, tier?: string, topK = 10) =>
    request<MemoryListResponse>("/api/memories/search", {
      method: "POST",
      body: JSON.stringify({ query, tier, top_k: topK }),
    }),

  retrieve: (query: string, topK = 5) =>
    request<MemoryListResponse>("/api/memories/retrieve", {
      method: "POST",
      body: JSON.stringify({ query, top_k: topK }),
    }),

  associate: (fromId: string, toId: string) =>
    request<{ status: string }>("/api/memories/associate", {
      method: "POST",
      body: JSON.stringify({ from_id: fromId, to_id: toId }),
    }),

  decay: () =>
    request<{ deleted: number }>("/api/memories/decay", { method: "POST" }),

  consolidate: () =>
    request<{ consolidated: number }>("/api/memories/consolidate", {
      method: "POST",
    }),

  prune: () =>
    request<{ pruned: number }>("/api/memories/prune", { method: "POST" }),
};

// ---------- Chat API ---------------------------------------------------------

export const chat = {
  send: (content: string, sessionId: string, apiKey?: string) =>
    request<SendMessageResponse>("/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ content, session_id: sessionId, api_key: apiKey || "" }),
    }),

  respond: (content: string, sessionId: string) =>
    request<ConversationMessage>("/api/chat/respond", {
      method: "POST",
      body: JSON.stringify({ content, session_id: sessionId }),
    }),

  history: (sessionId: string, limit = 50) =>
    request<ConversationMessage[]>(`/api/chat/history?session_id=${sessionId}&limit=${limit}`),

  sessions: () =>
    request<ChatSession[]>("/api/chat/sessions"),

  clear: (sessionId: string) =>
    request<{ status: string }>("/api/chat/clear", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  deleteSession: (sessionId: string) =>
    request<{ status: string }>(`/api/chat/sessions/${sessionId}`, {
      method: "DELETE",
    }),
};

// ---------- Stats API --------------------------------------------------------

export const stats = {
  get: () => request<StatsResponse>("/api/stats"),
  operations: (limit = 100) =>
    request<OperationEntry[]>(`/api/operations?limit=${limit}`),
};

// ---------- Tasks -------------------------------------------------------------

export interface TaskStepEntry {
  index: number;
  name: string;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  agentId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  checkpoint: Record<string, unknown> | null;
}

export interface TaskEntry {
  id: string;
  type: string;
  status: string;
  agentId: string | null;
  inputParams: Record<string, unknown>;
  result: Record<string, unknown> | null;
  progress: number;
  errorMessage: string | null;
  currentStep: number;
  totalSteps: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
  steps: TaskStepEntry[];
}

export interface TaskListResponse {
  tasks: TaskEntry[];
  total: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  stepCount: number;
}

export const tasks = {
  list: (status?: string, type?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    const qs = params.toString();
    return request<TaskListResponse>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },

  get: (uid: string) => request<TaskEntry>(`/api/tasks/${uid}`),

  create: (type: string, inputParams: Record<string, unknown> = {}) =>
    request<TaskEntry>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ type, inputParams }),
    }),

  start: (uid: string) =>
    request<{ status: string }>(`/api/tasks/${uid}/start`, { method: "POST" }),

  cancel: (uid: string) =>
    request<{ status: string }>(`/api/tasks/${uid}/cancel`, { method: "POST" }),

  resume: (uid: string) =>
    request<{ status: string }>(`/api/tasks/${uid}/resume`, { method: "POST" }),
};

export const agents = {
  list: () => request<AgentInfo[]>("/api/agents"),
};

// ---------- Health ------------------------------------------------------------

export const health = () =>
  request<{ status: string; version: string; memory_count: number }>(
    "/api/health",
  );
