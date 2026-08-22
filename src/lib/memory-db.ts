import Dexie, { type EntityTable } from "dexie";

// ─── Memory Hierarchy Types ─────────────────────────────────────────

export type MemoryTier =
  | "working"
  | "short_term"
  | "episodic"
  | "semantic"
  | "procedural";

export interface WorkingMemory {
  id?: number;
  sessionId: string;
  content: string;
  role: "user" | "assistant" | "system";
  tokenEstimate: number;
  timestamp: Date;
  /** Which tier this memory came from (for UI visualization) */
  source?: MemoryTier;
}

export interface ShortTermMemory {
  id?: number;
  sessionId: string;
  content: string;
  role: "user" | "assistant";
  tokenEstimate: number;
  importance: number; // 0-1
  lastAccessed: Date;
  createdAt: Date;
  /** Tags extracted during conversation */
  tags: string[];
  /** How many times this memory has been accessed */
  accessCount: number;
}

export interface EpisodicMemory {
  id?: number;
  sessionId: string;
  summary: string;
  keyPoints: string[];
  /** References to short-term memories that formed this episode */
  sourceMemoryIds: number[];
  importance: number; // 0-1
  emotionalTone?: string;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  accessCount: number;
}

export interface SemanticMemory {
  id?: number;
  /** Category: entity, fact, relationship, preference, concept */
  category: "entity" | "fact" | "relationship" | "preference" | "concept";
  subject: string;
  predicate: string;
  object: string;
  confidence: number; // 0-1
  /** How many times confirmed or used */
  reinforcementCount: number;
  createdAt: Date;
  lastAccessed: Date;
  /** Source episodes that contributed to this knowledge */
  sourceEpisodeIds: number[];
}

export interface ProceduralMemory {
  id?: number;
  name: string;
  description: string;
  /** Steps of the procedure */
  steps: string[];
  /** When to apply this procedure (triggers) */
  triggers: string[];
  successRate: number; // 0-1
  usageCount: number;
  createdAt: Date;
  lastUsed: Date;
  /** Source episodes where this pattern was observed */
  sourceEpisodeIds: number[];
}

export interface Conversation {
  id?: number;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokenEstimate: number;
  /** Memories used in generating this response */
  memoryRetrievals: MemoryRetrieval[];
}

export interface MemoryRetrieval {
  memoryId: number;
  memoryTier: MemoryTier;
  relevanceScore: number;
  snippet: string;
}

export interface MemoryStats {
  workingCount: number;
  shortTermCount: number;
  episodicCount: number;
  semanticCount: number;
  proceduralCount: number;
  totalConversations: number;
  lastConsolidation?: Date;
}

// ─── Database ───────────────────────────────────────────────────────

const db = new Dexie("MemoryHierarchicalDB") as Dexie & {
  workingMemory: EntityTable<WorkingMemory, "id">;
  shortTermMemory: EntityTable<ShortTermMemory, "id">;
  episodicMemory: EntityTable<EpisodicMemory, "id">;
  semanticMemory: EntityTable<SemanticMemory, "id">;
  proceduralMemory: EntityTable<ProceduralMemory, "id">;
  conversations: EntityTable<Conversation, "id">;
};

db.version(1).stores({
  workingMemory: "++id, sessionId, timestamp, role",
  shortTermMemory: "++id, sessionId, importance, createdAt, accessCount, *tags",
  episodicMemory:
    "++id, sessionId, importance, createdAt, accessCount, emotionalTone",
  semanticMemory:
    "++id, category, subject, confidence, reinforcementCount, createdAt",
  proceduralMemory: "++id, name, usageCount, successRate, createdAt",
  conversations: "++id, sessionId, timestamp, role",
});

export default db;

// ─── Helpers ────────────────────────────────────────────────────────

/** Rough token estimate (1 token ≈ 4 chars for English) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Generate a session ID */
export function newSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Get memory stats for the UI */
export async function getMemoryStats(): Promise<MemoryStats> {
  const [workingCount, shortTermCount, episodicCount, semanticCount, proceduralCount, totalConversations] =
    await Promise.all([
      db.workingMemory.count(),
      db.shortTermMemory.count(),
      db.episodicMemory.count(),
      db.semanticMemory.count(),
      db.proceduralMemory.count(),
      db.conversations.count(),
    ]);

  return {
    workingCount,
    shortTermCount,
    episodicCount,
    semanticCount,
    proceduralCount,
    totalConversations,
  };
}

/** Clear all working memory for a session */
export async function clearWorkingMemory(sessionId: string): Promise<void> {
  await db.workingMemory.where("sessionId").equals(sessionId).delete();
}

/** Clear everything (factory reset) */
export async function clearAllMemory(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.workingMemory,
      db.shortTermMemory,
      db.episodicMemory,
      db.semanticMemory,
      db.proceduralMemory,
      db.conversations,
    ],
    async () => {
      await db.workingMemory.clear();
      await db.shortTermMemory.clear();
      await db.episodicMemory.clear();
      await db.semanticMemory.clear();
      await db.proceduralMemory.clear();
      await db.conversations.clear();
    },
  );
}
