export type MemoryTier = 'sensory' | 'short_term' | 'long_term' | 'episodic' | 'procedural';

export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  content: string;
  importance: number; // 0-1
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  decayRate: number;
  tags: string[];
  metadata: Record<string, unknown>;
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
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  memoriesAccessed: string[];
  memoriesCreated: string[];
}
