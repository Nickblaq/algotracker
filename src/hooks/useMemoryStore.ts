import { useState, useCallback, useEffect, useRef } from "react";
import * as api from "../lib/api";
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "../lib/config";
import type {
  MemoryEntry,
  MemoryStats,
  ConversationMessage,
  MemoryTier,
} from "../types";
import type { OperationEntry, ChatSession } from "../lib/api";

const EMPTY_STATS: MemoryStats = {
  totalMemories: 0,
  tierCounts: { sensory: 0, short_term: 0, long_term: 0, episodic: 0, procedural: 0 },
  avgImportance: 0,
  consolidationRate: 0,
  retrievalAccuracy: 0,
  memoryUtilization: 0,
};

const SESSION_STORAGE_KEY = "hmm-session-id";

function generateSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useMemoryStore() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [operations, setOperations] = useState<OperationEntry[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [stats, setStats] = useState<MemoryStats>(EMPTY_STATS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTier, setSelectedTierState] = useState<MemoryTier | "all">("all");
  const [searchQuery, setSearchQueryState] = useState("");
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Current session ID — persisted in localStorage
  const [sessionId, setSessionIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY) || generateSessionId();
    } catch {
      return generateSessionId();
    }
  });
  const sessionIdRef = useRef(sessionId);

  const setSessionId = useCallback((id: string) => {
    setSessionIdState(id);
    sessionIdRef.current = id;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    } catch { /* ignore */ }
  }, []);

  // --- Refresh helpers -------------------------------------------------------

  const refreshMemories = useCallback(async () => {
    try {
      const res = await api.memories.list();
      setMemories(res.memories);
    } catch {
      setApiConnected(false);
    }
  }, []);

  const refreshOps = useCallback(async () => {
    try {
      const res = await api.stats.operations(100);
      setOperations(res);
    } catch { /* ignore */ }
  }, []);

  const refreshMessages = useCallback(async () => {
    try {
      const res = await api.chat.history(sessionIdRef.current, 50);
      setMessages(res);
    } catch { /* ignore */ }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const res = await api.stats.get();
      setStats(res as MemoryStats);
    } catch { /* ignore */ }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await api.chat.sessions();
      setSessions(res);
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      refreshMemories(),
      refreshOps(),
      refreshMessages(),
      refreshStats(),
      refreshSessions(),
    ]);
  }, [refreshMemories, refreshOps, refreshMessages, refreshStats, refreshSessions]);

  // --- Connection check + initial load ---------------------------------------

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await api.health();
        setApiConnected(true);
        if (mounted) await refresh();
      } catch {
        setApiConnected(false);
      }
    })();
    return () => { mounted = false; };
  }, [refresh]);

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      if (apiConnected) {
        refreshMemories();
        refreshOps();
        refreshStats();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [apiConnected, refreshMemories, refreshOps, refreshStats]);

  // --- Session management ----------------------------------------------------

  const switchSession = useCallback(async (newSessionId: string) => {
    setSessionId(newSessionId);
    // Load messages for the new session
    try {
      const res = await api.chat.history(newSessionId, 50);
      setMessages(res);
    } catch { /* ignore */ }
  }, [setSessionId]);

  const startNewChat = useCallback(() => {
    const newId = generateSessionId();
    setSessionId(newId);
    setMessages([]);
  }, [setSessionId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.chat.deleteSession(sessionId);
      // If we deleted the current session, start a new one
      if (sessionId === sessionIdRef.current) {
        startNewChat();
      }
      await refreshSessions();
    } catch { /* ignore */ }
  }, [startNewChat, refreshSessions]);

  // --- Process message (chat) ------------------------------------------------

  const processMessage = useCallback(
    async (content: string): Promise<string> => {
      setIsProcessing(true);
      const currentSessionId = sessionIdRef.current;
      try {
        // 1. Send user message to backend
        const sendRes = await api.chat.send(content, currentSessionId, OPENROUTER_API_KEY);

        // 2. Refresh client state
        await refresh();

        // 3. Call the LLM via OpenRouter with the embedded key
        const { system, messages: chatHistory } = sendRes.suggestedPrompt;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              { role: "system", content: system },
              ...chatHistory,
            ],
          }),
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        const assistantContent: string =
          data.choices?.[0]?.message?.content || "No response generated.";

        // 4. Store assistant response
        await api.chat.respond(assistantContent, currentSessionId);

        // 5. Final refresh
        await refresh();

        return assistantContent;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        try {
          await api.chat.respond(`Error: ${errorMsg}`, currentSessionId);
          await refresh();
        } catch { /* ignore */ }
        return `Error: ${errorMsg}`;
      } finally {
        setIsProcessing(false);
      }
    },
    [refresh],
  );

  // --- Tier & search filtering ------------------------------------------------

  const setSelectedTier = useCallback((tier: MemoryTier | "all") => {
    setSelectedTierState(tier);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const filteredMemories = memories.filter((mem) => {
    const tierMatch = selectedTier === "all" || mem.tier === selectedTier;
    const queryMatch =
      searchQuery === "" ||
      mem.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return tierMatch && queryMatch;
  });

  // --- Actions ---------------------------------------------------------------

  const manualAssociate = useCallback(
    async (idA: string, idB: string) => {
      try {
        await api.memories.associate(idA, idB);
        await refresh();
      } catch { /* ignore */ }
    },
    [refresh],
  );

  const manualPrune = useCallback(async () => {
    try {
      await api.memories.prune();
      await refresh();
    } catch { /* ignore */ }
  }, [refresh]);

  const manualConsolidate = useCallback(async () => {
    try {
      await api.memories.consolidate();
      await refresh();
    } catch { /* ignore */ }
  }, [refresh]);

  const createManualMemory = useCallback(
    async (content: string, tier: MemoryTier, importance: number, tags: string[]) => {
      try {
        await api.memories.create({ content, tier, importance, tags });
        await refresh();
      } catch { /* ignore */ }
    },
    [refresh],
  );

  const clearChat = useCallback(async () => {
    try {
      await api.chat.clear(sessionIdRef.current);
      await refresh();
    } catch { /* ignore */ }
  }, [refresh]);

  return {
    memories,
    operations,
    messages,
    stats,
    isProcessing,
    selectedTier,
    searchQuery,
    filteredMemories,
    apiConnected,
    sessions,
    sessionId,
    processMessage,
    setSelectedTier,
    setSearchQuery,
    manualAssociate,
    manualPrune,
    manualConsolidate,
    createManualMemory,
    clearChat,
    startNewChat,
    switchSession,
    deleteSession,
    refresh,
  };
}
