/**
 * HTTP client for the Python FastAPI backend.
 *
 * In development Next.js rewrites /api/* to http://127.0.0.1:8000 (see
 * next.config.ts), so these paths stay same-origin and the browser never
 * needs CORS.
 */

import type { ConversationMessage, MemoryEntry, MemoryTier } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------- Types (mirrors server/schemas.py) --------------------------------

export interface MemoryListResponse {
  memories: MemoryEntry[];
  total: number;
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
    request<MemoryListResponse>(`/api/memories${tier ? `?tier=${tier}` : ''}`),

  create: (data: {
    content: string;
    tier?: MemoryTier;
    importance?: number;
    tags?: string[];
  }) =>
    request<MemoryEntry>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (uid: string) => request<MemoryEntry>(`/api/memories/${uid}`),

  delete: (uid: string) =>
    request<void>(`/api/memories/${uid}`, { method: 'DELETE' }),

  search: (query: string, tier?: string, topK = 10) =>
    request<MemoryListResponse>('/api/memories/search', {
      method: 'POST',
      body: JSON.stringify({ query, tier, top_k: topK }),
    }),

  retrieve: (query: string, topK = 5) =>
    request<MemoryListResponse>('/api/memories/retrieve', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    }),

  decay: () =>
    request<{ deleted: number }>('/api/memories/decay', { method: 'POST' }),

  consolidate: () =>
    request<{ consolidated: number }>('/api/memories/consolidate', {
      method: 'POST',
    }),

  prune: () =>
    request<{ pruned: number }>('/api/memories/prune', { method: 'POST' }),
};

// ---------- Chat API ---------------------------------------------------------

export const chat = {
  send: (content: string, sessionId: string) =>
    request<SendMessageResponse>('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ content, session_id: sessionId }),
    }),

  respond: (content: string, sessionId: string) =>
    request<ConversationMessage>('/api/chat/respond', {
      method: 'POST',
      body: JSON.stringify({ content, session_id: sessionId }),
    }),

  history: (sessionId: string, limit = 50) =>
    request<ConversationMessage[]>(
      `/api/chat/history?session_id=${encodeURIComponent(sessionId)}&limit=${limit}`,
    ),

  clear: (sessionId: string) =>
    request<{ status: string }>(
      `/api/chat/clear?session_id=${encodeURIComponent(sessionId)}`,
      { method: 'POST' },
    ),
};

// ---------- LLM proxy --------------------------------------------------------

export const llm = {
  complete: (system: string, messages: Array<{ role: string; content: string }>) =>
    request<{ content: string }>('/api/llm', {
      method: 'POST',
      body: JSON.stringify({ system, messages }),
    }),
};

// ---------- Health -----------------------------------------------------------

export const health = () =>
  request<{ status: string; version: string; memory_count: number }>(
    '/api/health',
  );
