export type MemoryTier = 'sensory' | 'short_term' | 'long_term' | 'episodic' | 'procedural';

export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  content: string;
  embedding?: number[];
  importance: number; // 0-1
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  decayRate: number;
  tags: string[];
  metadata: Record<string, unknown>;
  associations: string[]; // IDs of related memories
  consolidated: boolean;
}

export interface TierCounts {
  sensory: number;
  short_term: number;
  long_term: number;
  episodic: number;
  procedural: number;
}

export interface MemoryStats {
  totalMemories: number;
  tierCounts: TierCounts;
  avgImportance: number;
  consolidationRate: number;
  retrievalAccuracy: number;
  memoryUtilization: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  memoriesAccessed: string[];
  memoriesCreated: string[];
}

export interface MemoryOperation {
  id: string;
  type: 'create' | 'consolidate' | 'decay' | 'retrieve' | 'associate' | 'prune';
  sourceTier: MemoryTier;
  targetTier?: MemoryTier | null;
  memoryId: string;
  timestamp: number;
  details: string;
}

export interface AppState {
  messages: ConversationMessage[];
  operations: MemoryOperation[];
  memories: MemoryEntry[];
  stats: MemoryStats;
  isProcessing: boolean;
  selectedTier: MemoryTier | 'all';
  searchQuery: string;
}
