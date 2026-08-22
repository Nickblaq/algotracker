import { useState, useCallback, useEffect, useRef } from "react";
import {
  buildContextWindow,
  storeUserMessage,
  storeAssistantMessage,
  getMemoryHierarchy,
  runFullConsolidation,
  pruneMemories,
  searchAllMemories,
  deleteMemory,
  clearTier,
  type retrieveMemories,
} from "@/lib/memory-engine";
import {
  newSessionId,
  getMemoryStats,
  clearAllMemory,
  type MemoryStats,
  type MemoryTier,
} from "@/lib/memory-db";
import { getApiKey, setApiKey, getSelectedModel, setSelectedModel } from "@/lib/openrouter";

// ─── Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  tokenEstimate?: number;
  memoryRetrievals?: Array<{
    memoryId: number;
    memoryTier: MemoryTier;
    relevanceScore: number;
    snippet: string;
  }>;
  isStreaming?: boolean;
}

export interface MemoryHierarchyData {
  working: any[];
  shortTerm: any[];
  episodic: any[];
  semantic: any[];
  procedural: any[];
  workingTokens: number;
  workingCapacity: number;
}

export interface SearchResult {
  tier: MemoryTier;
  id: number;
  content: string;
  score: number;
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useMemoryChat() {
  const [sessionId] = useState(() => newSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [hierarchy, setHierarchy] = useState<MemoryHierarchyData | null>(null);
  const [apiKey, setApiKeyState] = useState(() => getApiKey());
  const [model, setModelState] = useState(() => getSelectedModel());
  const [consolidationResult, setConsolidationResult] = useState<any>(null);
  const [pruneResult, setPruneResult] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [lastRetrievals, setLastRetrievals] = useState<any[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const refreshStats = useCallback(async () => {
    const s = await getMemoryStats();
    setStats(s);
    const h = await getMemoryHierarchy(sessionId);
    setHierarchy(h);
  }, [sessionId]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);

      // Add user message to UI
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        // Store in working + short-term memory
        await storeUserMessage(content.trim(), sessionId);

        // Build context window with retrieved memories
        const { messages: contextMessages, tokenEstimate, retrievals } =
          await buildContextWindow(content.trim(), sessionId);

        setLastRetrievals(retrievals);

        // Add streaming placeholder
        const assistantId = `assistant_${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          },
        ]);

        // Call OpenRouter
        const response = await chatCompletionDirect(contextMessages);

        // Update streaming message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: response.content, isStreaming: false }
              : m,
          ),
        );

        // Store assistant message
        await storeAssistantMessage(
          response.content,
          sessionId,
          retrievals,
          response.usage,
        );

        // Refresh memory state
        await refreshStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get response");
        // Remove streaming placeholder
        setMessages((prev) => prev.filter((m) => !m.isStreaming));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId, refreshStats],
  );

  const consolidate = useCallback(async () => {
    const result = await runFullConsolidation(sessionId);
    setConsolidationResult(result);
    await refreshStats();
    return result;
  }, [sessionId, refreshStats]);

  const prune = useCallback(async () => {
    const result = await pruneMemories();
    setPruneResult(result);
    await refreshStats();
    return result;
  }, [refreshStats]);

  const search = useCallback(async (query: string) => {
    const results = await searchAllMemories(query);
    setSearchResults(results);
    return results;
  }, []);

  const deleteMem = useCallback(
    async (tier: MemoryTier, id: number) => {
      await deleteMemory(tier, id);
      await refreshStats();
    },
    [refreshStats],
  );

  const clearMemoryTier = useCallback(
    async (tier: MemoryTier) => {
      await clearTier(tier, sessionId);
      await refreshStats();
    },
    [sessionId, refreshStats],
  );

  const resetAll = useCallback(async () => {
    await clearAllMemory();
    setMessages([]);
    setStats(null);
    setHierarchy(null);
    await refreshStats();
  }, [refreshStats]);

  const updateApiKey = useCallback((key: string) => {
    setApiKey(key);
    setApiKeyState(key);
  }, []);

  const updateModel = useCallback((m: string) => {
    setSelectedModel(m);
    setModelState(m);
  }, []);

  return {
    sessionId,
    messages,
    isLoading,
    error,
    stats,
    hierarchy,
    apiKey,
    model,
    consolidationResult,
    pruneResult,
    searchResults,
    lastRetrievals,
    sendMessage,
    consolidate,
    prune,
    search,
    deleteMem,
    clearMemoryTier,
    resetAll,
    refreshStats,
    updateApiKey,
    updateModel,
    messageEndRef,
  };
}

/** Direct fetch to OpenRouter (avoid circular import with memory-engine) */
async function chatCompletionDirect(
  messages: Array<{ role: string; content: string }>,
): Promise<{
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const apiKey = getApiKey();
  const model = getSelectedModel();

  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Click the gear icon to set it.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "MemoryLM",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg = `OpenRouter API error (${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      errorMsg = parsed.error?.message ?? errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? "",
    model: data.model ?? model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}
