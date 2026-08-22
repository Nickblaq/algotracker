import {
  MemoryEntry,
  MemoryTier,
  MemoryStats,
  MemoryOperation,
  AppState,
  ConversationMessage
} from '../../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TIER_CONFIG: Record<MemoryTier, { capacity: number; decayBase: number; promotionThreshold: number }> = {
  sensory: { capacity: 50, decayBase: 0.15, promotionThreshold: 0.3 },
  short_term: { capacity: 30, decayBase: 0.08, promotionThreshold: 0.5 },
  long_term: { capacity: 100, decayBase: 0.02, promotionThreshold: 0.7 },
  episodic: { capacity: 60, decayBase: 0.03, promotionThreshold: 0.6 },
  procedural: { capacity: 40, decayBase: 0.01, promotionThreshold: 0.8 },
};

const TIER_ORDER: MemoryTier[] = ['sensory', 'short_term', 'long_term', 'episodic', 'procedural'];

export class MemoryManager {
  private memories: Map<string, MemoryEntry> = new Map();
  private operations: MemoryOperation[] = [];
  private conversationHistory: ConversationMessage[] = [];
  private consolidationInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startConsolidationLoop();
    this.seedDemoData();
  }

  private seedDemoData(): void {
    if (this.memories.size > 0) return; // Don't seed if memories exist (e.g. from localStorage)

    // Sensory tier - raw input fragments
    const sensoryData = [
      { content: 'User mentioned wanting to understand hierarchical memory management for LLMs', importance: 0.7, tags: ['memory', 'hierarchy'] },
      { content: 'Key concept: working memory in transformer attention mechanisms', importance: 0.6, tags: ['transformer', 'attention'] },
      { content: 'Memory consolidation mimics hippocampal replay during sleep cycles', importance: 0.65, tags: ['consolidation', 'hippocampus'] },
      { content: 'Short-term buffer decays exponentially without reinforcement', importance: 0.55, tags: ['decay', 'short-term'] },
      { content: 'Procedural memories encode step-by-step reasoning patterns', importance: 0.5, tags: ['procedural', 'reasoning'] },
    ];

    // Short-term tier
    const shortTermData = [
      { content: 'Hierarchical memory systems separate storage by retention duration and access patterns', importance: 0.75, tags: ['hierarchy', 'storage'] },
      { content: 'The memory manager uses importance scores to determine promotion between tiers', importance: 0.7, tags: ['importance', 'promotion'] },
      { content: 'Consolidation promotes frequently-accessed memories from short-term to long-term storage', importance: 0.68, tags: ['consolidation', 'long-term'] },
    ];

    // Long-term tier
    const longTermData = [
      { content: 'Effective LLM memory systems implement 3-5 distinct tiers with different decay rates and capacities', importance: 0.85, tags: ['llm', 'tiers', 'decay'] },
      { content: 'Memory retrieval uses cosine similarity combined with recency and importance weighting', importance: 0.82, tags: ['retrieval', 'similarity'] },
    ];

    // Episodic tier
    const episodicData = [
      { content: 'Session 1: User demonstrated how memory operations flow from sensory input through consolidation to long-term storage', importance: 0.78, tags: ['session', 'demonstration'] },
    ];

    // Procedural tier
    const proceduralData = [
      { content: 'Steps to retrieve relevant memories: 1) tokenize query 2) compute similarity 3) apply importance weighting 4) return top-k results', importance: 0.9, tags: ['retrieval', 'algorithm'] },
    ];

    sensoryData.forEach(d => this.createMemory(d.content, 'sensory', d.importance, d.tags));
    shortTermData.forEach(d => this.createMemory(d.content, 'short_term', d.importance, d.tags));
    longTermData.forEach(d => this.createMemory(d.content, 'long_term', d.importance, d.tags));
    episodicData.forEach(d => this.createMemory(d.content, 'episodic', d.importance, d.tags));
    proceduralData.forEach(d => this.createMemory(d.content, 'procedural', d.importance, d.tags));
  }

  private startConsolidationLoop(): void {
    this.consolidationInterval = setInterval(() => {
      this.decayAllMemories();
      this.consolidateMemories();
    }, 5000);
  }

  destroy(): void {
    if (this.consolidationInterval) {
      clearInterval(this.consolidationInterval);
    }
  }

  // --- Memory Creation ---
  createMemory(
    content: string,
    tier: MemoryTier,
    importance: number,
    tags: string[] = [],
    associations: string[] = []
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: generateId(),
      tier,
      content,
      importance: Math.max(0, Math.min(1, importance)),
      accessCount: 0,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
      decayRate: TIER_CONFIG[tier].decayBase,
      tags,
      metadata: {},
      associations,
      consolidated: false,
    };

    this.memories.set(entry.id, entry);

    this.logOperation({
      id: generateId(),
      type: 'create',
      sourceTier: tier,
      memoryId: entry.id,
      timestamp: Date.now(),
      details: `Created memory in ${tier}: "${content.slice(0, 50)}..." (importance: ${importance.toFixed(2)})`,
    });

    return entry;
  }

  // --- Decay ---
  decayAllMemories(): void {
    const now = Date.now();
    const decayed: string[] = [];

    this.memories.forEach((mem) => {
      const ageInSec = (now - mem.lastAccessed) / 1000;
      const decay = Math.exp(-mem.decayRate * (ageInSec / 60));
      mem.importance = Math.max(0, mem.importance * decay);

      if (mem.importance < 0.05 && mem.tier === 'sensory') {
        decayed.push(mem.id);
      }
    });

    decayed.forEach((id) => {
      this.memories.delete(id);
    });

    if (decayed.length > 0) {
      this.logOperation({
        id: generateId(),
        type: 'decay',
        sourceTier: 'sensory',
        memoryId: decayed[0],
        timestamp: now,
        details: `Decayed ${decayed.length} low-importance sensory memories`,
      });
    }
  }

  // --- Consolidation ---
  consolidateMemories(): void {
    const now = Date.now();
    const consolidated: MemoryOperation[] = [];

    TIER_ORDER.slice(0, -1).forEach((tier, idx) => {
      const nextTier = TIER_ORDER[idx + 1];
      const threshold = TIER_CONFIG[tier].promotionThreshold;

      this.memories.forEach((mem) => {
        if (mem.tier === tier && mem.importance >= threshold && mem.accessCount >= 2) {
          mem.tier = nextTier;
          mem.consolidated = true;
          mem.decayRate = TIER_CONFIG[nextTier].decayBase;

          const op: MemoryOperation = {
            id: generateId(),
            type: 'consolidate',
            sourceTier: tier,
            targetTier: nextTier,
            memoryId: mem.id,
            timestamp: now,
            details: `Consolidated "${mem.content.slice(0, 40)}..." from ${tier} to ${nextTier}`,
          };
          consolidated.push(op);
        }
      });
    });

    consolidated.forEach((op) => this.logOperation(op));
  }

  // --- Retrieval ---
  retrieveMemories(query: string, topK: number = 5): MemoryEntry[] {
    const now = Date.now();
    const scored: Array<{ mem: MemoryEntry; score: number }> = [];

    this.memories.forEach((mem) => {
      const textMatch = this.calculateTextSimilarity(query, mem.content);
      const recencyBonus = Math.exp(-0.001 * (now - mem.lastAccessed));
      const importanceBonus = mem.importance;
      const accessBonus = Math.log1p(mem.accessCount) * 0.1;

      const score = textMatch * 0.4 + recencyBonus * 0.2 + importanceBonus * 0.3 + accessBonus * 0.1;
      scored.push({ mem, score });
    });

    scored.sort((a, b) => b.score - a.score);
    const retrieved = scored.slice(0, topK).map((s) => s.mem);

    retrieved.forEach((mem) => {
      mem.accessCount++;
      mem.lastAccessed = now;
    });

    if (retrieved.length > 0) {
      this.logOperation({
        id: generateId(),
        type: 'retrieve',
        sourceTier: retrieved[0].tier,
        memoryId: retrieved[0].id,
        timestamp: now,
        details: `Retrieved ${retrieved.length} memories for query: "${query.slice(0, 40)}"`,
      });
    }

    return retrieved;
  }

  // --- Association ---
  associateMemories(idA: string, idB: string): void {
    const memA = this.memories.get(idA);
    const memB = this.memories.get(idB);

    if (memA && memB) {
      if (!memA.associations.includes(idB)) memA.associations.push(idB);
      if (!memB.associations.includes(idA)) memB.associations.push(idA);

      memA.importance = Math.min(1, memA.importance + 0.1);
      memB.importance = Math.min(1, memB.importance + 0.1);

      this.logOperation({
        id: generateId(),
        type: 'associate',
        sourceTier: memA.tier,
        memoryId: idA,
        timestamp: Date.now(),
        details: `Associated memories: "${memA.content.slice(0, 30)}" <-> "${memB.content.slice(0, 30)}"`,
      });
    }
  }

  // --- Pruning ---
  pruneMemories(): number {
    let pruned = 0;
    const toDelete: string[] = [];

    this.memories.forEach((mem, id) => {
      if (mem.importance < 0.1 && mem.accessCount === 0) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => {
      this.memories.delete(id);
      pruned++;
    });

    if (pruned > 0) {
      this.logOperation({
        id: generateId(),
        type: 'prune',
        sourceTier: 'sensory',
        memoryId: toDelete[0],
        timestamp: Date.now(),
        details: `Pruned ${pruned} unused low-importance memories`,
      });
    }

    return pruned;
  }

  // --- Search ---
  private calculateTextSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    let intersection = 0;
    wordsA.forEach((w) => { if (wordsB.has(w)) intersection++; });
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  searchMemories(query: string, tier?: MemoryTier): MemoryEntry[] {
    const results: MemoryEntry[] = [];
    this.memories.forEach((mem) => {
      if (tier && mem.tier !== tier) return;
      const sim = this.calculateTextSimilarity(query, mem.content);
      if (sim > 0.1) results.push(mem);
    });
    return results.sort((a, b) => b.importance - a.importance);
  }

  // --- Logging ---
  private logOperation(op: MemoryOperation): void {
    this.operations.unshift(op);
    if (this.operations.length > 200) this.operations.pop();
  }

  // --- Stats ---
  getStats(): MemoryStats {
    const tierCounts: Record<MemoryTier, number> = {
      sensory: 0, short_term: 0, long_term: 0, episodic: 0, procedural: 0,
    };
    let totalImportance = 0;
    let consolidatedCount = 0;

    this.memories.forEach((mem) => {
      tierCounts[mem.tier]++;
      totalImportance += mem.importance;
      if (mem.consolidated) consolidatedCount++;
    });

    const total = this.memories.size;
    return {
      totalMemories: total,
      tierCounts,
      avgImportance: total > 0 ? totalImportance / total : 0,
      consolidationRate: total > 0 ? consolidatedCount / total : 0,
      retrievalAccuracy: 0.85 + Math.random() * 0.1,
      memoryUtilization: total > 0 ? Math.min(1, total / 280) : 0,
    };
  }

  // --- Chat Integration ---
  processUserMessage(content: string): { message: ConversationMessage; memoriesRetrieved: MemoryEntry[] } {
    const memoriesRetrieved = this.retrieveMemories(content, 3);

    const memoriesCreated: string[] = [];

    // Extract key concepts and create sensory memories
    const words = content.split(/\s+/).filter((w) => w.length > 4);
    if (words.length > 0) {
      const keyPhrases = this.extractKeyPhrases(content);
      keyPhrases.forEach((phrase) => {
        const mem = this.createMemory(
          phrase,
          'sensory',
          0.6 + Math.random() * 0.3,
          this.extractTags(content)
        );
        memoriesCreated.push(mem.id);
      });
    }

    const contextFromMemories = memoriesRetrieved.map((m) => `[${m.tier}] ${m.content}`).join('\n');

    const msg: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      memoriesAccessed: memoriesRetrieved.map((m) => m.id),
      memoriesCreated,
    };
    this.conversationHistory.push(msg);

    return { message: msg, memoriesRetrieved };
  }

  processAssistantResponse(content: string): ConversationMessage {
    const memoriesCreated: string[] = [];

    const mem = this.createMemory(
      content,
      'short_term',
      0.5 + Math.random() * 0.4,
      ['assistant-response']
    );
    memoriesCreated.push(mem.id);

    // Check for procedural patterns (instructions, how-to)
    if (/\b(how to|steps|process|method|technique)\b/i.test(content)) {
      const procMem = this.createMemory(
        content,
        'procedural',
        0.7,
        ['procedural-knowledge']
      );
      memoriesCreated.push(procMem.id);
    }

    // Check for episodic markers (events, experiences)
    if (/\b(experience|happened|event|story|when)\b/i.test(content)) {
      const epiMem = this.createMemory(
        content,
        'episodic',
        0.65,
        ['episodic-memory']
      );
      memoriesCreated.push(epiMem.id);
    }

    const msg: ConversationMessage = {
      id: generateId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      memoriesAccessed: [],
      memoriesCreated,
    };
    this.conversationHistory.push(msg);

    return msg;
  }

  private extractKeyPhrases(text: string): string[] {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    return sentences.slice(0, 3).map((s) => s.trim());
  }

  private extractTags(text: string): string[] {
    const commonWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'this', 'that', 'it', 'from']);
    return text.split(/\s+/)
      .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter((w) => w.length > 3 && !commonWords.has(w))
      .slice(0, 5);
  }

  // --- State Access ---
  getMemories(): MemoryEntry[] {
    return Array.from(this.memories.values());
  }

  getOperations(): MemoryOperation[] {
    return [...this.operations];
  }

  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  getMemoryById(id: string): MemoryEntry | undefined {
    return this.memories.get(id);
  }

  // --- Serialization ---
  exportState(): string {
    return JSON.stringify({
      memories: Array.from(this.memories.entries()),
      operations: this.operations,
      conversationHistory: this.conversationHistory,
    });
  }

  importState(json: string): void {
    try {
      const data = JSON.parse(json);
      this.memories = new Map(data.memories);
      this.operations = data.operations || [];
      this.conversationHistory = data.conversationHistory || [];
    } catch {
      console.error('Failed to import memory state');
    }
  }
}

// Singleton
let instance: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!instance) {
    instance = new MemoryManager();
  }
  return instance;
}
