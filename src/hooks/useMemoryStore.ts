import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
} from 'react';
import * as api from '../lib/api';
import type {
  MemoryEntry,
  MemoryFilter,
  MemorySort,
  MemoryStats,
  ConversationMessage,
  Toast,
  ToastTone,
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

// Session id lives outside React so the server can render a stable empty value
// and the client can hydrate from localStorage without a mismatch.
const sessionListeners = new Set<() => void>();
let sessionCache: string | null = null;

function currentSession(): string {
  if (sessionCache !== null) return sessionCache;
  if (typeof window === 'undefined') return '';
  const id = readSessionId();
  sessionCache = id;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function persistSession(id: string) {
  sessionCache = id;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  for (const listener of sessionListeners) listener();
}

const SORTERS: Record<MemorySort, (a: MemoryEntry, b: MemoryEntry) => number> = {
  weight: (a, b) => b.weight - a.weight,
  recent: (a, b) => b.lastAccessed - a.lastAccessed,
  accessed: (a, b) => b.accessCount - a.accessCount || b.weight - a.weight,
  edges: (a, b) => b.edgeCount - a.edgeCount || b.weight - a.weight,
};

function matchesFilter(mem: MemoryEntry, filter: MemoryFilter): boolean {
  switch (filter) {
    case 'strong':
      return mem.weight >= 0.6;
    case 'steady':
      return mem.weight >= 0.25 && mem.weight < 0.6;
    case 'fading':
      return mem.weight < 0.25;
    case 'connected':
      return mem.edgeCount > 0;
    default:
      return true;
  }
}

export function useMemoryStore() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [searchQuery, setSearchQueryState] = useState('');
  const [sort, setSort] = useState<MemorySort>('weight');
  const [filter, setFilter] = useState<MemoryFilter>('all');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);

  // Empty during SSR, then the stored session once hydrated.
  const sessionId = useSyncExternalStore(subscribeSession, currentSession, () => '');
  const sessionIdRef = useRef('');

  const ensureSession = useCallback(() => {
    const existing = sessionIdRef.current || currentSession();
    if (existing) {
      sessionIdRef.current = existing;
      return existing;
    }
    const created = generateSessionId();
    sessionIdRef.current = created;
    persistSession(created);
    return created;
  }, []);

  const setSessionId = useCallback((id: string) => {
    sessionIdRef.current = id;
    persistSession(id);
  }, []);

  // --- Toasts ---------------------------------------------------------------

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismissToast(id), 3600);
    },
    [dismissToast],
  );

  // --- Refresh ---------------------------------------------------------------

  const refreshMemories = useCallback(async () => {
    try {
      const res = await api.memories.list();
      setMemories(res.memories);
      setApiConnected(true);
    } catch {
      setApiConnected(false);
    } finally {
      setIsLoadingMemories(false);
    }
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!sessionIdRef.current) return;
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

  // --- Connection check + initial load --------------------------------------

  const connected = apiConnected === true;

  // Probe the backend once on mount, then keep probing every 5 seconds while
  // disconnected. Without this, one failed request would pin the indicator to
  // Offline until a reload.
  useEffect(() => {
    if (connected) return;

    let cancelled = false;

    const probe = async () => {
      try {
        await api.health();
        if (cancelled) return;
        setApiConnected(true);
        await refresh();
      } catch {
        if (!cancelled) {
          setApiConnected(false);
          setIsLoadingMemories(false);
        }
      }
    };

    void probe();
    const interval = setInterval(probe, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connected, refresh]);

  // Memories are the only thing that changes behind our back, so poll them.
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(refreshMemories, 5000);
    return () => clearInterval(interval);
  }, [connected, refreshMemories]);

  // --- Chat ------------------------------------------------------------------

  const processMessage = useCallback(
    async (content: string): Promise<string> => {
      setIsProcessing(true);
      const currentSessionId = ensureSession();
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
        notify(errorMsg, 'error');
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
    [refresh, notify, ensureSession],
  );

  const clearChat = useCallback(async () => {
    try {
      await api.chat.clear(ensureSession());
      setMessages([]);
      notify('Conversation cleared', 'success');
    } catch {
      notify('Could not clear the conversation', 'error');
    }
  }, [notify, ensureSession]);

  const startNewChat = useCallback(() => {
    const id = generateSessionId();
    sessionIdRef.current = id;
    persistSession(id);
    setMessages([]);
    notify('Started a new conversation', 'success');
  }, [notify]);

  // --- Search / sort / filter ------------------------------------------------

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const searchedMemories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return memories;
    return memories.filter(
      (mem) =>
        mem.content.toLowerCase().includes(query) ||
        mem.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [memories, searchQuery]);

  const filterCounts = useMemo<Record<MemoryFilter, number>>(
    () => ({
      all: searchedMemories.length,
      strong: searchedMemories.filter((m) => matchesFilter(m, 'strong')).length,
      steady: searchedMemories.filter((m) => matchesFilter(m, 'steady')).length,
      fading: searchedMemories.filter((m) => matchesFilter(m, 'fading')).length,
      connected: searchedMemories.filter((m) => matchesFilter(m, 'connected'))
        .length,
    }),
    [searchedMemories],
  );

  const filteredMemories = useMemo(() => {
    return searchedMemories
      .filter((mem) => matchesFilter(mem, filter))
      .sort(SORTERS[sort]);
  }, [searchedMemories, filter, sort]);

  const stats = useMemo<MemoryStats>(
    () => ({ totalMemories: memories.length }),
    [memories],
  );

  const strongest = useMemo(
    () => memories.reduce<MemoryEntry | null>((best, mem) => (!best || mem.weight > best.weight ? mem : best), null),
    [memories],
  );

  const totalEdges = useMemo(
    () => Math.round(memories.reduce((sum, mem) => sum + mem.edgeCount, 0) / 2),
    [memories],
  );

  const avgWeight = useMemo(
    () =>
      memories.length === 0
        ? 0
        : memories.reduce((sum, mem) => sum + mem.weight, 0) / memories.length,
    [memories],
  );

  const selectedMemory = useMemo(
    () => memories.find((mem) => mem.id === selectedMemoryId) ?? null,
    [memories, selectedMemoryId],
  );

  const memoryById = useMemo(() => {
    const map = new Map<string, MemoryEntry>();
    for (const mem of memories) map.set(mem.id, mem);
    return map;
  }, [memories]);

  const selectMemory = useCallback((id: string | null) => {
    setSelectedMemoryId(id);
  }, []);

  // --- Actions ---------------------------------------------------------------

  const manualPrune = useCallback(async () => {
    try {
      const { pruned } = await api.memories.prune();
      await refresh();
      notify(
        pruned === 0
          ? 'Nothing to prune — every memory still carries weight'
          : `Pruned ${pruned} faded ${pruned === 1 ? 'memory' : 'memories'}`,
        'success',
      );
      return pruned;
    } catch {
      notify('Prune failed — check the backend', 'error');
      return 0;
    }
  }, [refresh, notify]);

  const createManualMemory = useCallback(
    async (content: string, importance: number, tags: string[]) => {
      try {
        await api.memories.create({ content, importance, tags });
        await refresh();
        notify('Memory added', 'success');
        return true;
      } catch {
        notify('Could not add the memory', 'error');
        return false;
      }
    },
    [refresh, notify],
  );

  const deleteMemory = useCallback(
    async (uid: string) => {
      // Optimistic removal keeps the list responsive; the poll will restore it
      // if the delete actually failed.
      const previous = memories;
      setMemories((current) => current.filter((mem) => mem.id !== uid));
      if (selectedMemoryId === uid) setSelectedMemoryId(null);
      try {
        await api.memories.delete(uid);
        notify('Memory forgotten', 'success');
      } catch {
        setMemories(previous);
        notify('Could not delete the memory', 'error');
      }
    },
    [memories, selectedMemoryId, notify],
  );

  return {
    memories,
    filteredMemories,
    searchedMemories,
    filterCounts,
    messages,
    stats,
    strongest,
    totalEdges,
    avgWeight,
    isProcessing,
    isLoadingMemories,
    searchQuery,
    sort,
    filter,
    selectedMemory,
    memoryById,
    toasts,
    apiConnected,
    sessionId,
    processMessage,
    setSearchQuery,
    setSort,
    setFilter,
    selectMemory,
    setSessionId,
    manualPrune,
    createManualMemory,
    deleteMemory,
    clearChat,
    startNewChat,
    notify,
    dismissToast,
    refresh,
  };
}
