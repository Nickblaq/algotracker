import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Send,
  Loader2,
  Settings,
  X,
  Search,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  BookOpen,
  Lightbulb,
  Wrench,
  Clock,
  Database,
  ArrowLeft,
  AlertCircle,
  Layers,
  Cpu,
  Sparkles,
  Link2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMemoryChat, type ChatMessage, type MemoryHierarchyData, type SearchResult } from "@/hooks/use-memory";
import { AVAILABLE_MODELS } from "@/lib/openrouter";
import type { MemoryTier } from "@/lib/memory-db";
import { Link } from "react-router";

// ─── Tier Config ────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  MemoryTier,
  { label: string; icon: any; color: string; bgColor: string; description: string; limit?: string }
> = {
  working: {
    label: "Working Memory",
    icon: Cpu,
    color: "text-[oklch(0.72_0.19_180)]",
    bgColor: "bg-[oklch(0.72_0.19_180_/_0.1)]",
    description: "Active context window — what the LLM is currently 'thinking about'",
    limit: "4,096 tokens",
  },
  short_term: {
    label: "Short-Term Memory",
    icon: Clock,
    color: "text-[oklch(0.8_0.15_90)]",
    bgColor: "bg-[oklch(0.8_0.15_90_/_0.1)]",
    description: "Recent conversation turns — decays over time",
  },
  episodic: {
    label: "Episodic Memory",
    icon: BookOpen,
    color: "text-[oklch(0.72_0.19_160)]",
    bgColor: "bg-[oklch(0.72_0.19_160_/_0.1)]",
    description: "Summarized conversation episodes — what happened and when",
  },
  semantic: {
    label: "Semantic Memory",
    icon: Lightbulb,
    color: "text-[oklch(0.8_0.15_280)]",
    bgColor: "bg-[oklch(0.8_0.15_280_/_0.1)]",
    description: "Extracted facts, entities, and relationships",
  },
  procedural: {
    label: "Procedural Memory",
    icon: Wrench,
    color: "text-[oklch(0.65_0.2_25)]",
    bgColor: "bg-[oklch(0.65_0.2_25_/_0.1)]",
    description: "Learned patterns and procedures",
  },
};

// ─── Main Component ─────────────────────────────────────────────────

export default function ChatApp() {
  const {
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
  } = useMemoryChat();

  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTier, setExpandedTier] = useState<MemoryTier | null>("working");
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleConsolidate = async () => {
    setIsConsolidating(true);
    await consolidate();
    setIsConsolidating(false);
  };

  const handlePrune = async () => {
    setIsPruning(true);
    await prune();
    setIsPruning(false);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      search(searchQuery);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15 text-primary">
              <Brain className="size-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight font-mono">
                MemoryLM
              </span>
              <span className="text-[10px] text-muted-foreground font-mono ml-2">
                Hierarchical Memory for LLMs
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/explorer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs font-mono text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Database className="size-3" />
            Explorer
          </Link>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs font-mono text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings className="size-3" />
            Config
          </button>
        </div>
      </header>

      {/* Main Content: Chat + Memory Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-4">
            <div className="py-4 space-y-4">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary mb-4">
                    <Brain className="size-8" />
                  </div>
                  <h2 className="text-xl font-bold font-mono mb-2">
                    Hierarchical Memory
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
                    This assistant uses a five-tier memory hierarchy inspired by
                    cognitive science. It remembers, learns, and consolidates
                    knowledge as you converse. Watch the memory panel on the right
                    to see it in action.
                  </p>
                  <div className="grid grid-cols-5 gap-3 max-w-lg">
                    {(
                      Object.entries(TIER_CONFIG) as [
                        MemoryTier,
                        (typeof TIER_CONFIG)[MemoryTier],
                      ][]
                    ).map(([key, cfg]) => (
                      <div
                        key={key}
                        className={`${cfg.bgColor} rounded-lg p-2 text-center`}
                      >
                        <cfg.icon className={`size-4 mx-auto mb-1 ${cfg.color}`} />
                        <div className="text-[9px] font-mono text-muted-foreground leading-tight">
                          {cfg.label.split(" ")[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </AnimatePresence>

              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono pl-2">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Building context from memory hierarchy...</span>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive font-mono"
                >
                  <AlertCircle className="size-3" />
                  {error}
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="px-4 pb-3 pt-2 border-t border-border/30 shrink-0">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  !apiKey
                    ? "Click ⚙️ Config to set your OpenRouter API key first..."
                    : "Ask me anything — I'll use my memory hierarchy to respond..."
                }
                className="min-h-[44px] max-h-[120px] resize-none font-mono text-sm bg-secondary/30 border-border/50 focus:border-primary/50"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !apiKey}
                size="icon"
                className="shrink-0 h-[44px] w-[44px]"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Memory Panel (Right Side) */}
        <div className="w-[340px] border-l border-border/50 bg-card/30 flex flex-col overflow-hidden shrink-0 hidden lg:flex">
          <MemoryPanel
            hierarchy={hierarchy}
            stats={stats}
            expandedTier={expandedTier}
            setExpandedTier={setExpandedTier}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            handleSearch={handleSearch}
            handleConsolidate={handleConsolidate}
            handlePrune={handlePrune}
            isConsolidating={isConsolidating}
            isPruning={isPruning}
            deleteMem={deleteMem}
            clearMemoryTier={clearMemoryTier}
            lastRetrievals={lastRetrievals}
            model={model}
          />
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        model={model}
        onUpdateApiKey={updateApiKey}
        onUpdateModel={updateModel}
        onResetAll={resetAll}
      />
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [showRetrievals, setShowRetrievals] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isUser
            ? "bg-primary/15 text-foreground border border-primary/20"
            : "bg-secondary/50 text-foreground border border-border/40"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-2">
            <Brain className="size-3 text-primary" />
            <span className="text-[10px] font-mono text-primary font-semibold">
              MemoryLM
            </span>
          </div>
        )}

        <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
          {message.isStreaming ? (
            <span className="inline-flex items-center gap-1">
              <span className="animate-pulse">●</span>
              <span className="text-muted-foreground text-xs">Thinking...</span>
            </span>
          ) : (
            message.content
          )}
        </div>

        {message.memoryRetrievals && message.memoryRetrievals.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <button
              onClick={() => setShowRetrievals(!showRetrievals)}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <Link2 className="size-2.5" />
              {message.memoryRetrievals.length} memories retrieved
              {showRetrievals ? (
                <ChevronDown className="size-2.5" />
              ) : (
                <ChevronRight className="size-2.5" />
              )}
            </button>
            <AnimatePresence>
              {showRetrievals && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1">
                    {message.memoryRetrievals.map((r, i) => {
                      const cfg = TIER_CONFIG[r.memoryTier];
                      return (
                        <div
                          key={i}
                          className={`${cfg.bgColor} rounded-md px-2 py-1 text-[10px] font-mono`}
                        >
                          <span className={cfg.color}>{cfg.label}</span>
                          <span className="text-muted-foreground ml-1">
                            ({(r.relevanceScore * 100).toFixed(0)}%)
                          </span>
                          <div className="text-muted-foreground mt-0.5 line-clamp-2">
                            {r.snippet}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-1 text-[9px] text-muted-foreground/50 font-mono text-right">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Memory Panel ───────────────────────────────────────────────────

function MemoryPanel({
  hierarchy,
  stats,
  expandedTier,
  setExpandedTier,
  searchQuery,
  setSearchQuery,
  searchResults,
  handleSearch,
  handleConsolidate,
  handlePrune,
  isConsolidating,
  isPruning,
  deleteMem,
  clearMemoryTier,
  lastRetrievals,
  model,
}: {
  hierarchy: MemoryHierarchyData | null;
  stats: any;
  expandedTier: MemoryTier | null;
  setExpandedTier: (t: MemoryTier | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchResult[];
  handleSearch: () => void;
  handleConsolidate: () => void;
  handlePrune: () => void;
  isConsolidating: boolean;
  isPruning: boolean;
  deleteMem: (tier: MemoryTier, id: number) => void;
  clearMemoryTier: (tier: MemoryTier) => void;
  lastRetrievals: any[];
  model: string;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Memory Hierarchy */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-secondary/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold font-mono text-primary">
                {stats.totalConversations}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground">
                Messages
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold font-mono text-[oklch(0.72_0.19_160)]">
                {stats.episodicCount}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground">
                Episodes
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold font-mono text-[oklch(0.8_0.15_280)]">
                {stats.semanticCount}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground">
                Facts
              </div>
            </div>
          </div>
        )}

        {/* Working Memory Capacity */}
        {hierarchy && (
          <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Context Window
              </span>
              <span className="text-[10px] font-mono text-primary">
                {hierarchy.workingTokens}/{hierarchy.workingCapacity}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(hierarchy.workingTokens / hierarchy.workingCapacity) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <Cpu className="size-2.5 text-primary" />
              <span className="text-[9px] font-mono text-muted-foreground">
                {hierarchy.working.length} active items in working memory
              </span>
            </div>
          </div>
        )}

        {/* Memory Tiers */}
        {(
          Object.entries(TIER_CONFIG) as [
            MemoryTier,
            (typeof TIER_CONFIG)[MemoryTier],
          ][]
        ).map(([tier, config]) => {
          const isExpanded = expandedTier === tier;
          const count = getTierCount(tier, stats, hierarchy);

          return (
            <div
              key={tier}
              className={`rounded-lg border transition-colors ${
                isExpanded
                  ? `${config.bgColor} border-current/20`
                  : "bg-secondary/20 border-border/30 hover:border-border/60"
              }`}
            >
              <button
                onClick={() =>
                  setExpandedTier(isExpanded ? null : tier)
                }
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
              >
                <config.icon
                  className={`size-4 ${config.color} shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold font-mono">
                    {config.label}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono truncate">
                    {config.description}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[9px] font-mono shrink-0"
                >
                  {count}
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-1">
                      <TierContent
                        tier={tier}
                        hierarchy={hierarchy}
                        onDelete={deleteMem}
                        onClear={clearMemoryTier}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Search */}
        <div className="bg-secondary/20 rounded-lg border border-border/30 p-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Memory Search
          </div>
          <div className="flex gap-1.5">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search all memories..."
              className="h-7 text-xs font-mono bg-secondary/50 border-border/30"
            />
            <Button
              size="icon"
              onClick={handleSearch}
              className="h-7 w-7 shrink-0"
              variant="secondary"
            >
              <Search className="size-3" />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-auto">
              {searchResults.map((r, i) => {
                const cfg = TIER_CONFIG[r.tier];
                return (
                  <div
                    key={i}
                    className={`${cfg.bgColor} rounded px-2 py-1.5 text-[10px] font-mono cursor-pointer hover:opacity-80 transition-opacity`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cfg.color}>{cfg.label}</span>
                      <span className="text-muted-foreground">
                        {(r.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-0.5 line-clamp-1">
                      {r.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            onClick={handleConsolidate}
            disabled={isConsolidating}
            variant="secondary"
            className="w-full h-8 text-xs font-mono"
          >
            {isConsolidating ? (
              <Loader2 className="size-3 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="size-3 mr-1.5" />
            )}
            Consolidate Memory
          </Button>
          <Button
            onClick={handlePrune}
            disabled={isPruning}
            variant="secondary"
            className="w-full h-8 text-xs font-mono"
          >
            {isPruning ? (
              <Loader2 className="size-3 animate-spin mr-1.5" />
            ) : (
              <Trash2 className="size-3 mr-1.5" />
            )}
            Prune Low-Value Memories
          </Button>
        </div>

        {/* Last Retrievals Visualization */}
        {lastRetrievals.length > 0 && (
          <div className="bg-secondary/20 rounded-lg border border-border/30 p-3">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Last Retrieval Flow
            </div>
            <div className="space-y-1">
              {lastRetrievals.map((r, i) => {
                const cfg = TIER_CONFIG[r.memoryTier];
                return (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0`}
                      style={{
                        backgroundColor:
                          r.memoryTier === "working"
                            ? "oklch(0.72 0.19 180)"
                            : r.memoryTier === "short_term"
                              ? "oklch(0.8 0.15 90)"
                              : r.memoryTier === "episodic"
                                ? "oklch(0.72 0.19 160)"
                                : r.memoryTier === "semantic"
                                  ? "oklch(0.8 0.15 280)"
                                  : "oklch(0.65 0.2 25)",
                      }}
                    />
                    <span className="text-muted-foreground truncate flex-1">
                      {r.snippet.slice(0, 40)}...
                    </span>
                    <span className="text-muted-foreground/60 shrink-0">
                      {(r.relevanceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border/30 shrink-0">
        <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
          <Shield className="size-2.5" />
          <span>Session: {sessionId.slice(0, 12)}...</span>
          <span className="ml-auto">Model: {model.split("/").pop()}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tier Content ───────────────────────────────────────────────────

function TierContent({
  tier,
  hierarchy,
  onDelete,
  onClear,
}: {
  tier: MemoryTier;
  hierarchy: MemoryHierarchyData | null;
  onDelete: (tier: MemoryTier, id: number) => void;
  onClear: (tier: MemoryTier) => void;
}) {
  if (!hierarchy) return <div className="text-[10px] text-muted-foreground font-mono">No data</div>;

  const items = getTierItems(tier, hierarchy);
  const config = TIER_CONFIG[tier];

  if (items.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground/60 font-mono py-2 text-center">
        Empty — will populate as you chat
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-60 overflow-auto">
      {items.slice(0, 10).map((item: any, idx: number) => (
        <div
          key={item.id ?? idx}
          className="bg-background/50 rounded-md px-2 py-1.5 text-[10px] font-mono group"
        >
          <div className="flex items-start justify-between gap-1">
            <div className="line-clamp-3 text-muted-foreground leading-relaxed">
              {getItemText(tier, item)}
            </div>
            <button
              onClick={() => onDelete(tier, item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
            >
              <Trash2 className="size-2.5" />
            </button>
          </div>
          {tier === "semantic" && (
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="secondary" className="text-[8px] px-1 py-0">
                {item.category}
              </Badge>
              <span className="text-muted-foreground/50">
                confidence: {(item.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {tier === "short_term" && (
            <div className="flex items-center gap-1 mt-1">
              {item.tags?.slice(0, 3).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[8px] px-1 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {tier === "episodic" && item.keyPoints && (
            <div className="mt-1 space-y-0.5">
              {item.keyPoints.slice(0, 2).map((kp: string, i: number) => (
                <div key={i} className="text-muted-foreground/60 text-[9px]">
                  • {kp.slice(0, 60)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {items.length > 10 && (
        <div className="text-[9px] text-muted-foreground/50 font-mono text-center py-1">
          +{items.length - 10} more
        </div>
      )}
      <Button
        onClick={() => onClear(tier)}
        variant="ghost"
        className="w-full h-6 text-[9px] font-mono text-destructive/70 hover:text-destructive"
      >
        Clear {config.label}
      </Button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function getTierCount(
  tier: MemoryTier,
  stats: any,
  hierarchy: MemoryHierarchyData | null,
): number {
  if (!stats) return 0;
  switch (tier) {
    case "working":
      return hierarchy?.working.length ?? 0;
    case "short_term":
      return stats.shortTermCount;
    case "episodic":
      return stats.episodicCount;
    case "semantic":
      return stats.semanticCount;
    case "procedural":
      return stats.proceduralCount;
  }
}

function getTierItems(tier: MemoryTier, hierarchy: MemoryHierarchyData): any[] {
  switch (tier) {
    case "working":
      return hierarchy.working;
    case "short_term":
      return hierarchy.shortTerm;
    case "episodic":
      return hierarchy.episodic;
    case "semantic":
      return hierarchy.semantic;
    case "procedural":
      return hierarchy.procedural;
  }
}

function getItemText(tier: MemoryTier, item: any): string {
  switch (tier) {
    case "working":
      return `[${item.role}] ${item.content?.slice(0, 100)}`;
    case "short_term":
      return item.content?.slice(0, 120);
    case "episodic":
      return item.summary?.slice(0, 120);
    case "semantic":
      return `${item.subject} ${item.predicate} ${item.object}`;
    case "procedural":
      return `${item.name}: ${item.description?.slice(0, 100)}`;
  }
}

// ─── Settings Dialog ────────────────────────────────────────────────

function SettingsDialog({
  open,
  onClose,
  apiKey,
  model,
  onUpdateApiKey,
  onUpdateModel,
  onResetAll,
}: {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  model: string;
  onUpdateApiKey: (key: string) => void;
  onUpdateModel: (model: string) => void;
  onResetAll: () => void;
}) {
  const [tempKey, setTempKey] = useState(apiKey);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Settings className="size-4" />
            Configuration
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Set up your OpenRouter API key and select a model
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">
              OpenRouter API Key
            </label>
            <Input
              type="password"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
              Get your key at{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => onUpdateModel(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs font-mono text-foreground"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Danger Zone */}
          <div>
            <div className="text-xs font-mono text-destructive mb-2">
              Danger Zone
            </div>
            {confirmReset ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onResetAll();
                    setConfirmReset(false);
                  }}
                  variant="destructive"
                  className="h-8 text-xs font-mono"
                >
                  Confirm Reset
                </Button>
                <Button
                  onClick={() => setConfirmReset(false)}
                  variant="ghost"
                  className="h-8 text-xs font-mono"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setConfirmReset(true)}
                variant="outline"
                className="h-8 text-xs font-mono text-destructive border-destructive/30"
              >
                <Trash2 className="size-3 mr-1.5" />
                Reset All Memory
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                onUpdateApiKey(tempKey);
                onClose();
              }}
              className="flex-1 h-9 font-mono"
            >
              Save & Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
