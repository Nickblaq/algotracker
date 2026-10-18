import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as api from '../lib/api';
import type {
  MemoryEntry,
  MemoryStats,
  ConversationMessage,
  MemoryTier,
  TierCounts,
} from '../types';

const SESSION_STORAGE_KEY = 'hmm-session-id';

function generateSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readSessionId(): string {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) || generateSessionId();
  } catch {
    return generateSessionId();
  }
}

export function useMemoryStore() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTier, setSelectedTierState] = useState<MemoryTier | 'all'>('all');
  const [searchQuery, setSearchQueryState] = useState('');
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);

  // Current session ID — persisted in localStorage
  const [sessionId, setSessionIdState] = useState<string>(readSessionId);
  const sessionIdRef = useRef(sessionId);

  const setSessionId = useCallback((id: string) => {
    setSessionIdState(id);
    sessionIdRef.current = id;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  // --- Refresh ---------------------------------------------------------------

  const refreshMemories = useCallback(async () => {
    try {
      const res = await api.memories.list();
      setMemories(res.memories);
    } catch {
      setApiConnected(false);
    }
  }, []);

  const refreshMessages = useCallback(async () => {
    try {
      const res = await api.chat.history(sessionIdRef.current, 50);
      setMessages(res);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshMemories(), refreshMessages()]);
  }, [refreshMemories, refreshMessages]);

  // --- Connection check + initial load ---------------------------------------

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await api.health();
        if (!mounted) return;
        setApiConnected(true);
        await refresh();
      } catch {
        if (mounted) setApiConnected(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  // Memories are the only thing that changes behind our back, so poll them.
  useEffect(() => {
    if (!apiConnected) return;
    const interval = setInterval(refreshMemories, 5000);
    return () => clearInterval(interval);
  }, [apiConnected, refreshMemories]);

  // --- Chat ------------------------------------------------------------------

  const processMessage = useCallback(
    async (content: string): Promise<string> => {
      setIsProcessing(true);
      const currentSessionId = sessionIdRef.current;
      try {
        // 1. Store the user message and get the retrieved memory context
        const sendRes = await api.chat.send(content, currentSessionId);
        await refresh();

        // 2. Call the model through the server-side proxy
        const { content: assistantContent } = await api.llm.complete(
          sendRes.suggestedPrompt.system,
          sendRes.suggestedPrompt.messages,
        );

        // 3. Store the assistant reply, which also creates memories
        await api.chat.respond(
          assistantContent || 'No response generated.',
          currentSessionId,
        );
        await refresh();

        return assistantContent;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        try {
          await api.chat.respond(`Error: ${errorMsg}`, currentSessionId);
          await refresh();
        } catch {
          /* ignore */
        }
        return `Error: ${errorMsg}`;
      } finally {
        setIsProcessing(false);
      }
    },
    [refresh],
  );

  const clearChat = useCallback(async () => {
    try {
      await api.chat.clear(sessionIdRef.current);
      setMessages([]);
    } catch {
      /* ignore */
    }
  }, []);

  // --- Tier & search filtering ------------------------------------------------

  const setSelectedTier = useCallback((tier: MemoryTier | 'all') => {
    setSelectedTierState(tier);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const filteredMemories = useMemo(
    () =>
      memories.filter((mem) => {
        const tierMatch = selectedTier === 'all' || mem.tier === selectedTier;
        const query = searchQuery.toLowerCase();
        const queryMatch =
          query === '' ||
          mem.content.toLowerCase().includes(query) ||
          mem.tags.some((t) => t.toLowerCase().includes(query));
        return tierMatch && queryMatch;
      }),
    [memories, selectedTier, searchQuery],
  );

  // Tier counts are derived from the loaded list, so no stats endpoint is needed.
  const stats = useMemo<MemoryStats>(() => {
    const tierCounts: TierCounts = {
      sensory: 0,
      short_term: 0,
      long_term: 0,
      episodic: 0,
      procedural: 0,
    };
    for (const mem of memories) {
      tierCounts[mem.tier] += 1;
    }
    return { totalMemories: memories.length, tierCounts };
  }, [memories]);

  // --- Actions ----------------------------------------------------------------

  const manualPrune = useCallback(async () => {
    try {
      await api.memories.prune();
      await refresh();
    } catch {
      /* ignore */
    }
  }, [refresh]);

  const manualConsolidate = useCallback(async () => {
    try {
      await api.memories.consolidate();
      await refresh();
    } catch {
      /* ignore */
    }
  }, [refresh]);

  const createManualMemory = useCallback(
    async (content: string, tier: MemoryTier, importance: number, tags: string[]) => {
      try {
        await api.memories.create({ content, tier, importance, tags });
        await refresh();
      } catch {
        /* ignore */
      }
    },
    [refresh],
  );

  return {
    memories,
    messages,
    stats,
    isProcessing,
    selectedTier,
    searchQuery,
    filteredMemories,
    apiConnected,
    sessionId,
    processMessage,
    setSelectedTier,
    setSearchQuery,
    setSessionId,
    manualPrune,
    manualConsolidate,
    createManualMemory,
    clearChat,
    refresh,
  };
}
