import { useState, type CSSProperties } from 'react';
import type { MemoryEntry, MemoryTier, MemoryStats } from '@/types';

interface Props {
  memories: MemoryEntry[];
  stats: MemoryStats;
  selectedTier: MemoryTier | 'all';
  onSelectTier: (tier: MemoryTier | 'all') => void;
  onCreateMemory: (content: string, tier: MemoryTier, importance: number, tags: string[]) => void;
}

const TIER_COLORS: Record<MemoryTier, string> = {
  sensory: '#F97316',
  short_term: '#EAB308',
  long_term: '#0EA5E9',
  episodic: '#8B5CF6',
  procedural: '#EC4899',
};

const TIER_BG: Record<MemoryTier, string> = {
  sensory: '#FFF7ED',
  short_term: '#FEFCE8',
  long_term: '#F0F9FF',
  episodic: '#F5F3FF',
  procedural: '#FDF2F8',
};

const TIER_LABELS: Record<MemoryTier, string> = {
  sensory: 'Sensory',
  short_term: 'Short-Term',
  long_term: 'Long-Term',
  episodic: 'Episodic',
  procedural: 'Procedural',
};

const TIER_DESC: Record<MemoryTier, string> = {
  sensory: 'Raw input buffer',
  short_term: 'Working memory',
  long_term: 'Persistent knowledge',
  episodic: 'Experience-based',
  procedural: 'Skill memory',
};

export function MemoryTierView({ memories, stats, selectedTier, onSelectTier, onCreateMemory }: Props) {
  const [expandedTier, setExpandedTier] = useState<MemoryTier | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMemory, setNewMemory] = useState({ content: '', tier: 'sensory' as MemoryTier, importance: 0.5, tags: '' });

  const tiers: MemoryTier[] = ['sensory', 'short_term', 'long_term', 'episodic', 'procedural'];

  return (
    <div className="tier-view">
      <div className="tier-view-header">
        <h2>Memory Tiers</h2>
        <button className="btn btn-ghost btn-xs" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? '✕' : '+ Add'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-memory-form">
          <textarea
            placeholder="Enter memory content..."
            value={newMemory.content}
            onChange={e => setNewMemory(p => ({ ...p, content: e.target.value }))}
            className="input"
            rows={2}
          />
          <div className="form-row">
            <select
              value={newMemory.tier}
              onChange={e => setNewMemory(p => ({ ...p, tier: e.target.value as MemoryTier }))}
              className="select"
            >
              {tiers.map(t => (
                <option key={t} value={t}>{TIER_LABELS[t]}</option>
              ))}
            </select>
            <label className="range-label">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={newMemory.importance}
                onChange={e => setNewMemory(p => ({ ...p, importance: parseFloat(e.target.value) }))}
              />
              {newMemory.importance.toFixed(2)}
            </label>
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8, width: '100%' }}
            onClick={() => {
              if (newMemory.content.trim()) {
                onCreateMemory(
                  newMemory.content,
                  newMemory.tier,
                  newMemory.importance,
                  newMemory.tags ? newMemory.tags.split(',').map(t => t.trim()) : [],
                );
                setNewMemory({ content: '', tier: 'sensory', importance: 0.5, tags: '' });
                setShowCreateForm(false);
              }
            }}
          >
            Add Memory
          </button>
        </div>
      )}

      {/* Filter pills */}
      <div className="tier-filters">
        <button
          className={`tier-filter-btn ${selectedTier === 'all' ? 'active' : ''}`}
          onClick={() => onSelectTier('all')}
        >
          All ({memories.length})
        </button>
        {tiers.map(t => (
          <button
            key={t}
            className={`tier-filter-btn ${selectedTier === t ? 'active' : ''}`}
            onClick={() => onSelectTier(t)}
          >
            {TIER_LABELS[t]} ({stats.tierCounts[t as keyof typeof stats.tierCounts]})
          </button>
        ))}
      </div>

      {/* Tier cards */}
      <div>
        {tiers.map(tier => {
          const tierMemories = memories.filter(m => m.tier === tier);
          const isExpanded = expandedTier === tier || selectedTier === tier;

          return (
            <div
              key={tier}
              className="tier-card"
              style={{ '--tier-color': TIER_COLORS[tier], '--tier-bg': TIER_BG[tier] } as CSSProperties}
            >
              <button
                className="tier-card-header"
                onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
              >
                <div className="tier-indicator" />
                <div className="tier-info">
                  <span className="tier-name">{TIER_LABELS[tier]}</span>
                  <span className="tier-desc">{TIER_DESC[tier]}</span>
                </div>
                <span className="tier-count">{tierMemories.length}</span>
                <span className="tier-expand">{isExpanded ? '▾' : '▸'}</span>
              </button>

              {isExpanded && (
                <div className="tier-memory-list">
                  {tierMemories.length === 0 ? (
                    <div className="empty-tier">No memories in this tier</div>
                  ) : (
                    tierMemories.slice(0, 15).map(mem => (
                      <div key={mem.id} className="memory-item">
                        <div className="memory-item-header">
                          <div className="importance-bar" style={{ width: `${mem.importance * 100}%` }} />
                          <span className="memory-access-count">×{mem.accessCount}</span>
                        </div>
                        <p className="memory-content">{mem.content}</p>
                        <div className="memory-item-footer">
                          <span className="memory-time">{timeAgo(mem.createdAt)}</span>
                          <div className="memory-tags">
                            {mem.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="memory-tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
