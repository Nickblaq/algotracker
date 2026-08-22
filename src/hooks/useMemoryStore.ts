import { useState, useCallback, useRef, useEffect } from 'react';
import { MemoryManager, getMemoryManager } from '../lib/memory/MemoryManager';
import {
  MemoryEntry,
  MemoryOperation,
  ConversationMessage,
  MemoryStats,
  MemoryTier,
  AppState,
} from '../types';

const EMPTY_STATS: MemoryStats = {
  totalMemories: 0,
  tierCounts: { sensory: 0, short_term: 0, long_term: 0, episodic: 0, procedural: 0 },
  avgImportance: 0,
  consolidationRate: 0,
  retrievalAccuracy: 0,
  memoryUtilization: 0,
};

const STORAGE_KEY = 'hmm-state';

function loadPersistedState(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useMemoryStore() {
  const managerRef = useRef<MemoryManager>(getMemoryManager());
  const [state, setState] = useState<AppState>({
    messages: [],
    operations: [],
    memories: [],
    stats: EMPTY_STATS,
    isProcessing: false,
    selectedTier: 'all',
    searchQuery: '',
  });

  const refresh = useCallback(() => {
    const mgr = managerRef.current;
    setState((prev) => ({
      ...prev,
      memories: mgr.getMemories(),
      operations: mgr.getOperations(),
      messages: mgr.getConversationHistory(),
      stats: mgr.getStats(),
    }));
  }, []);

  // Restore persisted state on first mount
  useEffect(() => {
    const persisted = loadPersistedState();
    if (persisted) {
      managerRef.current.importState(persisted);
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh from manager (captures decay/consolidation loop updates)
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Persist state every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        localStorage.setItem(STORAGE_KEY, managerRef.current.exportState());
      } catch { /* quota exceeded, ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const processMessage = useCallback(
    async (content: string, apiKey: string): Promise<string> => {
      const mgr = managerRef.current;
      setState((prev) => ({ ...prev, isProcessing: true }));

      try {
        const { message: userMsg, memoriesRetrieved } = mgr.processUserMessage(content);
        refresh();

        const contextFromMemories = memoriesRetrieved
          .map((m) => `[${m.tier}] ${m.content}`)
          .join('\n');

        const chatMessages = mgr.getConversationHistory().slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const systemPrompt = `You are a helpful AI assistant demonstrating hierarchical memory management.
You have access to the following memories from previous interactions:
${contextFromMemories || '(No memories retrieved yet)'}

Use these memories to provide contextual responses. Mention when you recall something from memory.`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: [
              { role: 'system', content: systemPrompt },
              ...chatMessages,
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const assistantContent = data.choices?.[0]?.message?.content || 'No response generated.';

        mgr.processAssistantResponse(assistantContent);
        refresh();

        return assistantContent;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        mgr.processAssistantResponse(`Error: ${errorMsg}`);
        refresh();
        return `Error: ${errorMsg}`;
      } finally {
        setState((prev) => ({ ...prev, isProcessing: false }));
      }
    },
    [refresh]
  );

  const setSelectedTier = useCallback((tier: MemoryTier | 'all') => {
    setState((prev) => ({ ...prev, selectedTier: tier }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const filteredMemories = state.memories.filter((mem) => {
    const tierMatch = state.selectedTier === 'all' || mem.tier === state.selectedTier;
    const queryMatch =
      state.searchQuery === '' ||
      mem.content.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      mem.tags.some((t) => t.toLowerCase().includes(state.searchQuery.toLowerCase()));
    return tierMatch && queryMatch;
  });

  const manualAssociate = useCallback(
    (idA: string, idB: string) => {
      managerRef.current.associateMemories(idA, idB);
      refresh();
    },
    [refresh]
  );

  const manualPrune = useCallback(() => {
    managerRef.current.pruneMemories();
    refresh();
  }, [refresh]);

  const manualConsolidate = useCallback(() => {
    managerRef.current.consolidateMemories();
    refresh();
  }, [refresh]);

  const createManualMemory = useCallback(
    (content: string, tier: MemoryTier, importance: number, tags: string[]) => {
      managerRef.current.createMemory(content, tier, importance, tags);
      refresh();
    },
    [refresh]
  );

  const clearChat = useCallback(() => {
    managerRef.current.clearConversation();
    refresh();
  }, [refresh]);

  return {
    ...state,
    filteredMemories,
    processMessage,
    setSelectedTier,
    setSearchQuery,
    manualAssociate,
    manualPrune,
    manualConsolidate,
    createManualMemory,
    clearChat,
    refresh,
  };
}
