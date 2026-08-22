/**
 * MemoryEngine — Hierarchical Memory Management for LLMs
 *
 * Implements a five-tier memory hierarchy inspired by cognitive science:
 * 1. Working Memory   — Active context window (most recent + retrieved)
 * 2. Short-Term       — Recent conversation turns (decays over time)
 * 3. Episodic         — Summarized conversation episodes
 * 4. Semantic         — Extracted facts, entities, relationships
 * 5. Procedural       — Learned patterns, preferences, procedures
 *
 * Key operations:
 * - retrieve()    — Search all tiers for relevant memories to inject into context
 * - consolidate() — Promote memories up the hierarchy (short-term → episodic → semantic)
 * - prune()       — Remove low-value memories from lower tiers
 * - search()      — Full-text search across all memory tiers
 */

import db, {
  estimateTokens,
  type Conversation,
  type EpisodicMemory,
  type MemoryRetrieval,
  type MemoryTier,
  type ProceduralMemory,
  type SemanticMemory,
  type ShortTermMemory,
  type WorkingMemory,
} from "./memory-db";
import { chatCompletion, type ChatMessage } from "./openrouter";

// ─── Constants ──────────────────────────────────────────────────────

const WORKING_MEMORY_LIMIT = 4096; // tokens
const SHORT_TERM_MAX = 50;
const EPISODIC_CONSOLIDATION_THRESHOLD = 8; // consolidate after N short-term entries
const DECAY_HALF_LIFE_MS = 30 * 60 * 1000; // 30 minutes

// ─── Memory Retrieval ───────────────────────────────────────────────

/**
 * Retrieve memories from all tiers relevant to a query.
 * Returns memories sorted by relevance with tier attribution.
 */
export async function retrieveMemories(
  query: string,
  sessionId: string,
  limit = 10,
): Promise<MemoryRetrieval[]> {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const retrievals: MemoryRetrieval[] = [];

  // 1. Search Short-Term Memory (most recent, highest relevance)
  const shortTerm = await db.shortTermMemory
    .where("sessionId")
    .equals(sessionId)
    .reverse()
    .limit(20)
    .toArray();

  for (const mem of shortTerm) {
    const score = computeRelevance(queryTerms, mem.content + " " + mem.tags.join(" "));
    if (score > 0.1) {
      retrievals.push({
        memoryId: mem.id!,
        memoryTier: "short_term",
        relevanceScore: score * 1.2, // boost recency
        snippet: mem.content.slice(0, 200),
      });
    }
  }

  // 2. Search Episodic Memory (summarized conversations)
  const episodes = await db.episodicMemory.orderBy("createdAt").reverse().toArray();
  for (const ep of episodes) {
    const score = computeRelevance(
      queryTerms,
      ep.summary + " " + ep.keyPoints.join(" "),
    );
    if (score > 0.1) {
      retrievals.push({
        memoryId: ep.id!,
        memoryTier: "episodic",
        relevanceScore: score * 1.1,
        snippet: ep.summary.slice(0, 200),
      });
    }
  }

  // 3. Search Semantic Memory (facts, entities, relationships)
  const semantics = await db.semanticMemory.toArray();
  for (const sem of semantics) {
    const score = computeRelevance(
      queryTerms,
      `${sem.subject} ${sem.predicate} ${sem.object}`,
    );
    if (score > 0.1) {
      retrievals.push({
        memoryId: sem.id!,
        memoryTier: "semantic",
        relevanceScore: score * 1.3, // semantic is high-value
        snippet: `${sem.subject} ${sem.predicate} ${sem.object}`,
      });
    }
  }

  // 4. Search Procedural Memory (patterns, procedures)
  const procedures = await db.proceduralMemory.toArray();
  for (const proc of procedures) {
    const score = computeRelevance(
      queryTerms,
      `${proc.name} ${proc.description} ${proc.triggers.join(" ")}`,
    );
    if (score > 0.1) {
      retrievals.push({
        memoryId: proc.id!,
        memoryTier: "procedural",
        relevanceScore: score,
        snippet: proc.description.slice(0, 200),
      });
    }
  }

  // Sort by relevance and limit
  retrievals.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return retrievals.slice(0, limit);
}

/** Simple keyword overlap scoring (0-1) */
function computeRelevance(queryTerms: string[], text: string): number {
  const textLower = text.toLowerCase();
  if (queryTerms.length === 0) return 0;
  let matches = 0;
  for (const term of queryTerms) {
    if (textLower.includes(term)) matches++;
  }
  return matches / queryTerms.length;
}

// ─── Build Context Window ───────────────────────────────────────────

/**
 * Build the full context window for the LLM:
 * [System Prompt] + [Retrieved Memories] + [Working Memory] + [New User Message]
 */
export async function buildContextWindow(
  userMessage: string,
  sessionId: string,
): Promise<{ messages: ChatMessage[]; tokenEstimate: number; retrievals: MemoryRetrieval[] }> {
  // 1. Retrieve relevant memories
  const retrievals = await retrieveMemories(userMessage, sessionId, 8);

  // 2. Format retrieved memories as context
  let memoryContext = "";
  if (retrievals.length > 0) {
    const tierLabels: Record<MemoryTier, string> = {
      working: "Working",
      short_term: "Short-Term",
      episodic: "Episodic",
      semantic: "Semantic",
      procedural: "Procedural",
    };
    memoryContext =
      "\n\n[RETRIEVED MEMORIES]\n" +
      retrievals
        .map(
          (r) =>
            `[${tierLabels[r.memoryTier]} Memory] (relevance: ${(r.relevanceScore * 100).toFixed(0)}%) ${r.snippet}`,
        )
        .join("\n");
  }

  // 3. Get working memory (recent conversation context)
  const working = await db.workingMemory
    .where("sessionId")
    .equals(sessionId)
    .sortBy("timestamp");

  const workingContext = working
    .map((w) => `${w.role === "user" ? "User" : "Assistant"}: ${w.content}`)
    .join("\n");

  // 4. Build system prompt
  const systemPrompt = `You are an intelligent assistant with hierarchical memory. You have access to different memory tiers:
- [Working Memory]: Your current active context
- [Short-Term Memory]: Recent conversation history  
- [Episodic Memory]: Summarized past conversations
- [Semantic Memory]: Facts and knowledge you've learned
- [Procedural Memory]: Patterns and procedures you follow

Use the retrieved memories to inform your responses. When you notice new facts, preferences, or patterns, mention them. Be natural and helpful.
${memoryContext}`;

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // Add working memory as conversation history
  if (workingContext) {
    messages.push({ role: "assistant", content: workingContext });
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  const tokenEstimate =
    estimateTokens(systemPrompt) +
    estimateTokens(workingContext) +
    estimateTokens(userMessage);

  return { messages, tokenEstimate, retrievals };
}

// ─── Store Memories ─────────────────────────────────────────────────

/** Store a user message in short-term and working memory */
export async function storeUserMessage(
  content: string,
  sessionId: string,
): Promise<void> {
  const tokens = estimateTokens(content);

  // Add to working memory
  await db.workingMemory.add({
    sessionId,
    content,
    role: "user",
    tokenEstimate: tokens,
    timestamp: new Date(),
  });

  // Add to short-term memory
  await db.shortTermMemory.add({
    sessionId,
    content,
    role: "user",
    tokenEstimate: tokens,
    importance: 0.5,
    lastAccessed: new Date(),
    createdAt: new Date(),
    tags: extractSimpleTags(content),
    accessCount: 0,
  });

  // Trim working memory if over limit
  await trimWorkingMemory(sessionId);
}

/** Store an assistant response in short-term and working memory */
export async function storeAssistantMessage(
  content: string,
  sessionId: string,
  retrievals: MemoryRetrieval[],
  usage: { promptTokens: number; completionTokens: number },
): Promise<number> {
  const tokens = estimateTokens(content);

  // Add to working memory
  await db.workingMemory.add({
    sessionId,
    content,
    role: "assistant",
    tokenEstimate: tokens,
    timestamp: new Date(),
  });

  // Add to short-term memory
  const id = await db.shortTermMemory.add({
    sessionId,
    content,
    role: "assistant",
    tokenEstimate: tokens,
    importance: 0.6,
    lastAccessed: new Date(),
    createdAt: new Date(),
    tags: extractSimpleTags(content),
    accessCount: 0,
  });

  // Store conversation record
  await db.conversations.add({
    sessionId,
    role: "assistant",
    content,
    timestamp: new Date(),
    tokenEstimate: tokens,
    memoryRetrievals: retrievals,
  });

  // Trim working memory
  await trimWorkingMemory(sessionId);

  // Check if we should auto-consolidate
  const shortTermCount = await db.shortTermMemory
    .where("sessionId")
    .equals(sessionId)
    .count();
  if (shortTermCount >= EPISODIC_CONSOLIDATION_THRESHOLD) {
    await consolidateEpisode(sessionId);
  }

  return id;
}

/** Trim working memory to stay within token limit */
async function trimWorkingMemory(sessionId: string): Promise<void> {
  const items = await db.workingMemory
    .where("sessionId")
    .equals(sessionId)
    .sortBy("timestamp");

  let totalTokens = 0;
  const toRemove: number[] = [];

  for (const item of items) {
    totalTokens += item.tokenEstimate;
    if (totalTokens > WORKING_MEMORY_LIMIT) {
      toRemove.push(item.id!);
    }
  }

  if (toRemove.length > 0) {
    await db.workingMemory.bulkDelete(toRemove);
  }
}

/** Extract simple keyword tags from text */
function extractSimpleTags(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Remove common stop words
  const stopWords = new Set([
    "this", "that", "with", "from", "have", "been", "were", "they",
    "their", "would", "could", "should", "about", "which", "when",
    "what", "there", "your", "just", "also", "more", "some", "than",
    "into", "only", "other", "very", "does", "will", "each", "make",
    "like", "over", "such", "take", "most", "much", "many",
  ]);

  return [...new Set(words.filter((w) => !stopWords.has(w)))].slice(0, 5);
}

// ─── Consolidation ──────────────────────────────────────────────────

/**
 * Consolidate recent short-term memories into an episodic memory.
 * Uses the LLM to generate a summary.
 */
export async function consolidateEpisode(
  sessionId: string,
): Promise<EpisodicMemory | null> {
  const recentMemories = await db.shortTermMemory
    .where("sessionId")
    .equals(sessionId)
    .reverse()
    .limit(EPISODIC_CONSOLIDATION_THRESHOLD)
    .toArray();

  if (recentMemories.length < 3) return null;

  const conversationText = recentMemories
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // Try to use LLM for summary, fall back to local summary
  let summary: string;
  let keyPoints: string[];

  try {
    const result = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Summarize this conversation segment in 2-3 sentences. Then extract 3-5 key points as a JSON array. Return ONLY valid JSON: {\"summary\": \"...\", \"keyPoints\": [\"...\", \"...\"]}",
        },
        {
          role: "user",
          content: conversationText.slice(0, 3000),
        },
      ],
      { maxTokens: 500, temperature: 0.3 },
    );

    const parsed = JSON.parse(result.content);
    summary = parsed.summary;
    keyPoints = parsed.keyPoints;
  } catch {
    // Fallback: create a local summary
    summary = `Conversation segment with ${recentMemories.length} exchanges. Topics discussed: ${[...new Set(recentMemories.flatMap((m) => m.tags))].slice(0, 5).join(", ")}.`;
    keyPoints = recentMemories.map((m) => m.content.slice(0, 100));
  }

  // Determine emotional tone
  const emotionalTone = analyzeEmotionalTone(conversationText);

  // Calculate importance based on content length and tag diversity
  const allTags = recentMemories.flatMap((m) => m.tags);
  const uniqueTags = new Set(allTags);
  const importance = Math.min(
    1,
    0.3 + (uniqueTags.size / 10) * 0.3 + (recentMemories.length / 10) * 0.4,
  );

  const episode: Omit<EpisodicMemory, "id"> = {
    sessionId,
    summary,
    keyPoints,
    sourceMemoryIds: recentMemories.map((m) => m.id!),
    importance,
    emotionalTone,
    startTime: recentMemories[recentMemories.length - 1].createdAt,
    endTime: recentMemories[0].createdAt,
    createdAt: new Date(),
    accessCount: 0,
  };

  const id = await db.episodicMemory.add(episode as EpisodicMemory);

  // Try to extract semantic knowledge from the episode
  await extractSemanticKnowledge(id, summary, keyPoints);

  return { ...episode, id } as EpisodicMemory;
}

/**
 * Extract semantic knowledge from an episode summary.
 * Uses the LLM to identify facts, entities, and relationships.
 */
async function extractSemanticKnowledge(
  episodeId: number,
  summary: string,
  keyPoints: string[],
): Promise<void> {
  const text = `Summary: ${summary}\nKey points: ${keyPoints.join("; ")}`;

  try {
    const result = await chatCompletion(
      [
        {
          role: "system",
          content: `Extract factual knowledge from this conversation summary. Return a JSON array of facts, each with:
- category: "entity" | "fact" | "relationship" | "preference" | "concept"
- subject: the main topic
- predicate: what about it (e.g., "prefers", "is_a", "uses")
- object: the value/detail
Return ONLY valid JSON array: [{"category": "...", "subject": "...", "predicate": "...", "object": "..."}]`,
        },
        {
          role: "user",
          content: text.slice(0, 2000),
        },
      ],
      { maxTokens: 500, temperature: 0.2 },
    );

    const facts: Array<{
      category: SemanticMemory["category"];
      subject: string;
      predicate: string;
      object: string;
    }> = JSON.parse(result.content);

    for (const fact of facts) {
      if (!fact.subject || !fact.predicate || !fact.object) continue;

      // Check for existing similar semantic memory
      const existing = await db.semanticMemory
        .where("subject")
        .equals(fact.subject.toLowerCase())
        .first();

      if (existing) {
        // Reinforce existing knowledge
        await db.semanticMemory.update(existing.id!, {
          reinforcementCount: existing.reinforcementCount + 1,
          confidence: Math.min(1, existing.confidence + 0.1),
          lastAccessed: new Date(),
          sourceEpisodeIds: [...new Set([...existing.sourceEpisodeIds, episodeId])],
        });
      } else {
        // Create new semantic memory
        await db.semanticMemory.add({
          category: fact.category,
          subject: fact.subject.toLowerCase(),
          predicate: fact.predicate.toLowerCase(),
          object: fact.object,
          confidence: 0.6,
          reinforcementCount: 1,
          createdAt: new Date(),
          lastAccessed: new Date(),
          sourceEpisodeIds: [episodeId],
        });
      }
    }
  } catch (err) {
    console.warn("Semantic extraction failed:", err);
  }
}

/**
 * Detect procedural patterns from conversation history.
 * Identifies repeated sequences of actions or preferences.
 */
export async function detectProceduralPatterns(
  sessionId: string,
): Promise<ProceduralMemory[]> {
  // Get all episodic memories
  const episodes = await db.episodicMemory.toArray();
  if (episodes.length < 3) return [];

  try {
    const episodeSummaries = episodes
      .map((e) => `Episode: ${e.summary}\nKey points: ${e.keyPoints.join("; ")}`)
      .join("\n\n");

    const result = await chatCompletion(
      [
        {
          role: "system",
          content: `Analyze these conversation episodes and identify recurring patterns, procedures, or user preferences. For each pattern found, return:
- name: short name for the pattern
- description: what this pattern does
- steps: array of steps in the procedure
- triggers: when to apply this procedure
Return ONLY valid JSON array: [{"name": "...", "description": "...", "steps": ["..."], "triggers": ["..."]}]`,
        },
        {
          role: "user",
          content: episodeSummaries.slice(0, 4000),
        },
      ],
      { maxTokens: 800, temperature: 0.3 },
    );

    const patterns: Array<{
      name: string;
      description: string;
      steps: string[];
      triggers: string[];
    }> = JSON.parse(result.content);

    const procedures: ProceduralMemory[] = [];

    for (const pattern of patterns) {
      if (!pattern.name || !pattern.description) continue;

      // Check for existing similar procedure
      const existing = await db.proceduralMemory
        .where("name")
        .equals(pattern.name.toLowerCase())
        .first();

      if (existing) {
        await db.proceduralMemory.update(existing.id!, {
          usageCount: existing.usageCount + 1,
          successRate: Math.min(1, existing.successRate + 0.05),
          lastUsed: new Date(),
        });
      } else {
        const id = await db.proceduralMemory.add({
          name: pattern.name.toLowerCase(),
          description: pattern.description,
          steps: pattern.steps,
          triggers: pattern.triggers,
          successRate: 0.5,
          usageCount: 1,
          createdAt: new Date(),
          lastUsed: new Date(),
          sourceEpisodeIds: episodes.map((e) => e.id!),
        });
        procedures.push({ ...pattern, id } as unknown as ProceduralMemory);
      }
    }

    return procedures;
  } catch (err) {
    console.warn("Procedural pattern detection failed:", err);
    return [];
  }
}

// ─── Memory Operations ──────────────────────────────────────────────

/** Simple local emotional tone analysis */
function analyzeEmotionalTone(text: string): string {
  const lower = text.toLowerCase();
  const positive = ["thank", "great", "love", "awesome", "perfect", "excellent", "good", "happy", "wonderful"];
  const negative = ["error", "fail", "wrong", "bad", "hate", "broken", "issue", "problem", "stuck"];
  const neutral = ["okay", "sure", "right", "yes", "no"];

  let posScore = positive.filter((w) => lower.includes(w)).length;
  let negScore = negative.filter((w) => lower.includes(w)).length;
  let neuScore = neutral.filter((w) => lower.includes(w)).length;

  if (posScore > negScore && posScore > neuScore) return "positive";
  if (negScore > posScore && negScore > neuScore) return "negative";
  return "neutral";
}

/** Full-text search across all memory tiers */
export async function searchAllMemories(
  query: string,
  limit = 20,
): Promise<
  Array<{ tier: MemoryTier; id: number; content: string; score: number }>
> {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const results: Array<{
    tier: MemoryTier;
    id: number;
    content: string;
    score: number;
  }> = [];

  // Search each tier
  const [shortTerm, episodic, semantic, procedural] = await Promise.all([
    db.shortTermMemory.toArray(),
    db.episodicMemory.toArray(),
    db.semanticMemory.toArray(),
    db.proceduralMemory.toArray(),
  ]);

  for (const m of shortTerm) {
    const score = computeRelevance(queryTerms, m.content + " " + m.tags.join(" "));
    if (score > 0.05)
      results.push({ tier: "short_term", id: m.id!, content: m.content.slice(0, 300), score });
  }

  for (const e of episodic) {
    const score = computeRelevance(queryTerms, e.summary + " " + e.keyPoints.join(" "));
    if (score > 0.05)
      results.push({ tier: "episodic", id: e.id!, content: e.summary.slice(0, 300), score });
  }

  for (const s of semantic) {
    const score = computeRelevance(queryTerms, `${s.subject} ${s.predicate} ${s.object}`);
    if (score > 0.05)
      results.push({
        tier: "semantic",
        id: s.id!,
        content: `${s.subject} ${s.predicate} ${s.object}`,
        score,
      });
  }

  for (const p of procedural) {
    const score = computeRelevance(queryTerms, `${p.name} ${p.description}`);
    if (score > 0.05)
      results.push({ tier: "procedural", id: p.id!, content: p.description.slice(0, 300), score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Run full consolidation pipeline */
export async function runFullConsolidation(
  sessionId: string,
): Promise<{ episodesConsolidated: number; semanticsExtracted: number; proceduresDetected: number }> {
  let episodesConsolidated = 0;

  // Consolidate remaining short-term into episodes
  const shortTermCount = await db.shortTermMemory
    .where("sessionId")
    .equals(sessionId)
    .count();

  if (shortTermCount >= 3) {
    const ep = await consolidateEpisode(sessionId);
    if (ep) episodesConsolidated++;
  }

  // Detect procedural patterns
  const procedures = await detectProceduralPatterns(sessionId);

  // Count current semantics
  const semanticsCount = await db.semanticMemory.count();

  return {
    episodesConsolidated,
    semanticsExtracted: semanticsCount,
    proceduresDetected: procedures.length,
  };
}

/** Prune low-value memories */
export async function pruneMemories(): Promise<{
  shortTermRemoved: number;
  episodicRemoved: number;
  semanticRemoved: number;
}> {
  const now = Date.now();

  // Prune old, low-importance short-term memories (> 2 hours old, importance < 0.3)
  const oldShortTerm = await db.shortTermMemory
    .where("createdAt")
    .below(new Date(now - 2 * 60 * 60 * 1000))
    .toArray();

  let shortTermRemoved = 0;
  for (const m of oldShortTerm) {
    if (m.importance < 0.3 && m.accessCount < 2) {
      await db.shortTermMemory.delete(m.id!);
      shortTermRemoved++;
    }
  }

  // Prune very low confidence semantic memories
  const lowConfidenceSemantic = await db.semanticMemory
    .where("confidence")
    .below(0.2)
    .toArray();

  let semanticRemoved = 0;
  for (const s of lowConfidenceSemantic) {
    if (s.reinforcementCount <= 1) {
      await db.semanticMemory.delete(s.id!);
      semanticRemoved++;
    }
  }

  // Prune very low importance episodic memories
  const lowEpisodes = await db.episodicMemory
    .where("importance")
    .below(0.2)
    .toArray();

  let episodicRemoved = 0;
  for (const e of lowEpisodes) {
    if (e.accessCount < 2) {
      await db.episodicMemory.delete(e.id!);
      episodicRemoved++;
    }
  }

  return { shortTermRemoved, episodicRemoved, semanticRemoved };
}

/** Get complete memory hierarchy for visualization */
export async function getMemoryHierarchy(sessionId: string) {
  const [working, shortTerm, episodic, semantic, procedural] = await Promise.all([
    db.workingMemory.where("sessionId").equals(sessionId).toArray(),
    db.shortTermMemory.where("sessionId").equals(sessionId).reverse().sortBy("createdAt"),
    db.episodicMemory.orderBy("createdAt").reverse().toArray(),
    db.semanticMemory.toArray(),
    db.proceduralMemory.toArray(),
  ]);

  const workingTokens = working.reduce((sum, w) => sum + w.tokenEstimate, 0);

  return {
    working,
    shortTerm,
    episodic,
    semantic,
    procedural,
    workingTokens,
    workingCapacity: WORKING_MEMORY_LIMIT,
  };
}

/** Delete a specific memory by tier and ID */
export async function deleteMemory(
  tier: MemoryTier,
  id: number,
): Promise<void> {
  switch (tier) {
    case "working":
      await db.workingMemory.delete(id);
      break;
    case "short_term":
      await db.shortTermMemory.delete(id);
      break;
    case "episodic":
      await db.episodicMemory.delete(id);
      break;
    case "semantic":
      await db.semanticMemory.delete(id);
      break;
    case "procedural":
      await db.proceduralMemory.delete(id);
      break;
  }
}

/** Clear a specific tier */
export async function clearTier(tier: MemoryTier, sessionId?: string): Promise<void> {
  switch (tier) {
    case "working":
      if (sessionId) await db.workingMemory.where("sessionId").equals(sessionId).delete();
      else await db.workingMemory.clear();
      break;
    case "short_term":
      if (sessionId) await db.shortTermMemory.where("sessionId").equals(sessionId).delete();
      else await db.shortTermMemory.clear();
      break;
    case "episodic":
      await db.episodicMemory.clear();
      break;
    case "semantic":
      await db.semanticMemory.clear();
      break;
    case "procedural":
      await db.proceduralMemory.clear();
      break;
  }
}
